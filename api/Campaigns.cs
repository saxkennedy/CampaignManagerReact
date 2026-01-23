using System;
using System.IO;
using System.Linq;
using System.Net;
using System.Security.Claims;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using CampaignManager.Services.Models;
using CampaignManager.Services.Services.Abstractions;
using Data.Models;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;

namespace api
{
    public class CampaignFunctions
    {
        private readonly CampaignManagerContext _db;
        private readonly ICampaignAdminService _admin;
        private readonly ILogger<CampaignFunctions> _log;

        public CampaignFunctions(CampaignManagerContext db, ICampaignAdminService admin, ILogger<CampaignFunctions> log)
        {
            _db = db;
            _admin = admin;
            _log = log;
        }

        private static readonly JsonSerializerOptions JsonOpts = new()
        {
            PropertyNameCaseInsensitive = true
        };

        private sealed class JoinRequest
        {
            public string? Password { get; set; }
        }

        private static ClaimsPrincipal? ValidateJwt(HttpRequestData req)
        {
            if (!req.Headers.TryGetValues("Authorization", out var authHeaders))
                return null;

            var auth = authHeaders.FirstOrDefault();
            if (string.IsNullOrWhiteSpace(auth) || !auth.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
                return null;

            var token = auth.Substring("Bearer ".Length).Trim();

            var secret = Environment.GetEnvironmentVariable("JwtSecret");
            if (string.IsNullOrWhiteSpace(secret) || secret.Length < 32)
                return null;

            try
            {
                var handler = new JwtSecurityTokenHandler();
                var principal = handler.ValidateToken(token, new TokenValidationParameters
                {
                    ValidateIssuerSigningKey = true,
                    IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secret)),
                    ValidateIssuer = true,
                    ValidIssuer = "enderdnd",
                    ValidateAudience = true,
                    ValidAudience = "enderdnd",
                    ValidateLifetime = true,
                    ClockSkew = TimeSpan.FromMinutes(1)
                }, out _);

                return principal;
            }
            catch
            {
                return null;
            }
        }

        private static Guid? GetUserId(ClaimsPrincipal principal)
        {
            var userIdStr = principal.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            return Guid.TryParse(userIdStr, out var userId) ? userId : null;
        }

        // ---------- LIST JOINABLE ----------
        [Function("Campaigns_ListJoinable")]
        public async Task<HttpResponseData> ListJoinable(
            [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "campaigns/joinable")] HttpRequestData req)
        {
            var principal = ValidateJwt(req);
            if (principal == null)
                return req.CreateResponse(HttpStatusCode.Unauthorized);

            var rows = await _db.Set<Campaign>()
                .AsNoTracking()
                .Select(c => new
                {
                    id = c.Id,
                    name = c.Name,
                    description = c.Description,
                    isPasswordProtected = !string.IsNullOrEmpty(c.CampaignJoinPassword)
                })
                .OrderBy(c => c.name)
                .ToListAsync();

            var ok = req.CreateResponse(HttpStatusCode.OK);
            await ok.WriteAsJsonAsync(rows);
            return ok;
        }

        // ---------- JOIN ----------
        [Function("Campaigns_Join")]
        public async Task<HttpResponseData> Join(
            [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "campaigns/{campaignId:guid}/join")] HttpRequestData req,
            Guid campaignId)
        {
            var principal = ValidateJwt(req);
            if (principal == null)
                return req.CreateResponse(HttpStatusCode.Unauthorized);

            var userId = GetUserId(principal);
            if (userId == null)
                return req.CreateResponse(HttpStatusCode.Unauthorized);

            JoinRequest joinReq = new JoinRequest();
            try
            {
                using var reader = new StreamReader(req.Body);
                var raw = await reader.ReadToEndAsync();
                if (!string.IsNullOrWhiteSpace(raw))
                    joinReq = JsonSerializer.Deserialize<JoinRequest>(raw, JsonOpts) ?? new JoinRequest();
            }
            catch { }

            var campaign = await _db.Set<Campaign>().AsNoTracking().FirstOrDefaultAsync(c => c.Id == campaignId);
            if (campaign == null)
                return req.CreateResponse(HttpStatusCode.NotFound);

            // ✅ FIX: nullable CampaignJoinPersonaId
            if (!campaign.CampaignJoinPersonaId.HasValue || campaign.CampaignJoinPersonaId.Value == Guid.Empty)
            {
                var bad = req.CreateResponse(HttpStatusCode.BadRequest);
                await bad.WriteAsJsonAsync(new { joined = false, error = "CampaignJoinPersonaId is not configured for this campaign." });
                return bad;
            }

            var joinPersonaId = campaign.CampaignJoinPersonaId.Value;

            var joinPersonaBelongs = await _db.Set<CampaignPersona>()
                .AsNoTracking()
                .AnyAsync(cp => cp.Id == joinPersonaId && cp.CampaignId == campaignId);

            if (!joinPersonaBelongs)
            {
                var bad = req.CreateResponse(HttpStatusCode.BadRequest);
                await bad.WriteAsJsonAsync(new { joined = false, error = "CampaignJoinPersonaId does not belong to this campaign." });
                return bad;
            }

            var requiredPassword = campaign.CampaignJoinPassword;
            var protectedCampaign = !string.IsNullOrEmpty(requiredPassword);
            if (protectedCampaign)
            {
                var provided = joinReq.Password ?? "";
                if (!string.Equals(requiredPassword, provided, StringComparison.Ordinal))
                {
                    var forbidden = req.CreateResponse(HttpStatusCode.Forbidden);
                    await forbidden.WriteAsJsonAsync(new { joined = false, error = "Invalid join password" });
                    return forbidden;
                }
            }

            var campaignPersonaIds = _db.Set<CampaignPersona>()
                .Where(cp => cp.CampaignId == campaignId)
                .Select(cp => cp.Id);

            var alreadyMember = await _db.Set<UserCampaignPersona>()
                .AsNoTracking()
                .AnyAsync(ucp => ucp.UserId == userId.Value && campaignPersonaIds.Contains(ucp.CampaignPersonaId));

            if (alreadyMember)
            {
                var okAlready = req.CreateResponse(HttpStatusCode.OK);
                await okAlready.WriteAsJsonAsync(new { joined = true, alreadyMember = true });
                return okAlready;
            }

            _db.Set<UserCampaignPersona>().Add(new UserCampaignPersona
            {
                UserId = userId.Value,
                CampaignPersonaId = joinPersonaId
            });

            await _db.SaveChangesAsync();

            var ok = req.CreateResponse(HttpStatusCode.OK);
            await ok.WriteAsJsonAsync(new { joined = true, alreadyMember = false });
            return ok;
        }

        // ---------- CREATE ----------
        [Function("Campaigns_Create")]
        public async Task<HttpResponseData> Create(
            [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "campaigns")] HttpRequestData req)
        {
            var principal = ValidateJwt(req);
            if (principal == null)
                return req.CreateResponse(HttpStatusCode.Unauthorized);

            var userId = GetUserId(principal);
            if (userId == null)
                return req.CreateResponse(HttpStatusCode.Unauthorized);

            CampaignUpsertRequest? body;
            using (var reader = new StreamReader(req.Body))
            {
                var raw = await reader.ReadToEndAsync();
                body = JsonSerializer.Deserialize<CampaignUpsertRequest>(raw, JsonOpts);
            }

            if (body == null)
            {
                var bad = req.CreateResponse(HttpStatusCode.BadRequest);
                await bad.WriteAsJsonAsync(new { error = "Invalid request body." });
                return bad;
            }

            try
            {
                var created = await _admin.CreateCampaign(userId.Value, body);

                var ok = req.CreateResponse(HttpStatusCode.OK);
                await ok.WriteAsJsonAsync(created);
                return ok;
            }
            catch (Exception ex)
            {
                var bad = req.CreateResponse(HttpStatusCode.BadRequest);
                await bad.WriteAsJsonAsync(new { error = ex.Message });
                return bad;
            }
        }
    }
}
