using System;
using System.IO;
using System.Linq;
using System.Net;
using System.Security.Claims;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using System.IdentityModel.Tokens.Jwt;
using CampaignManager.Services.Models;
using CampaignManager.Services.Services.Abstractions;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Logging;
using Microsoft.IdentityModel.Tokens;

namespace api
{
    /// <summary>
    /// Campaign Administration — Tab 2 (personas) and Tab 3 (member reassignment).
    /// All routes require a valid JWT; authority is enforced in the service layer.
    /// </summary>
    public class CampaignPersonaAdminFunctions
    {
        private readonly ICampaignAdminService _admin;
        private readonly ILogger<CampaignPersonaAdminFunctions> _log;

        public CampaignPersonaAdminFunctions(ICampaignAdminService admin, ILogger<CampaignPersonaAdminFunctions> log)
        {
            _admin = admin;
            _log = log;
        }

        private static readonly JsonSerializerOptions JsonOpts = new() { PropertyNameCaseInsensitive = true };

        // ---------- permission catalog ----------

        [Function("CampaignAdmin_GetAssignablePermissions")]
        public async Task<HttpResponseData> GetAssignablePermissions(
            [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "permissions/assignable")] HttpRequestData req)
        {
            var userId = Authorize(req);
            if (userId == null) return req.CreateResponse(HttpStatusCode.Unauthorized);

            try
            {
                var result = await _admin.GetAssignablePermissions();
                var ok = req.CreateResponse(HttpStatusCode.OK);
                await ok.WriteAsJsonAsync(result);
                return ok;
            }
            catch (Exception ex) { return await HandleException(req, ex); }
        }

        // ---------- personas ----------

        [Function("CampaignAdmin_GetPersonas")]
        public async Task<HttpResponseData> GetPersonas(
            [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "campaignadmin/{campaignId:guid}/personas")] HttpRequestData req,
            Guid campaignId)
        {
            var userId = Authorize(req);
            if (userId == null) return req.CreateResponse(HttpStatusCode.Unauthorized);

            try
            {
                var result = await _admin.GetPersonaManagement(userId.Value, campaignId);
                var ok = req.CreateResponse(HttpStatusCode.OK);
                await ok.WriteAsJsonAsync(result);
                return ok;
            }
            catch (Exception ex) { return await HandleException(req, ex); }
        }

        [Function("CampaignAdmin_UpsertPersona")]
        public async Task<HttpResponseData> UpsertPersona(
            [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "campaignadmin/{campaignId:guid}/personas")] HttpRequestData req,
            Guid campaignId)
        {
            var userId = Authorize(req);
            if (userId == null) return req.CreateResponse(HttpStatusCode.Unauthorized);

            PersonaUpsertRequest body;
            try { body = await ReadBody<PersonaUpsertRequest>(req); }
            catch { return await BadJson(req); }
            if (body == null) return await BadJson(req);

            try
            {
                var result = await _admin.UpsertPersona(userId.Value, campaignId, body);
                var ok = req.CreateResponse(HttpStatusCode.OK);
                await ok.WriteAsJsonAsync(result);
                return ok;
            }
            catch (Exception ex) { return await HandleException(req, ex); }
        }

        [Function("CampaignAdmin_DeletePersona")]
        public async Task<HttpResponseData> DeletePersona(
            [HttpTrigger(AuthorizationLevel.Anonymous, "delete", Route = "campaignadmin/{campaignId:guid}/personas/{personaId:guid}")] HttpRequestData req,
            Guid campaignId,
            Guid personaId)
        {
            var userId = Authorize(req);
            if (userId == null) return req.CreateResponse(HttpStatusCode.Unauthorized);

            try
            {
                var result = await _admin.DeletePersona(userId.Value, campaignId, personaId);
                // Blocked-by-members is a normal outcome, not an error: 409 with the member list.
                var status = result.Deleted ? HttpStatusCode.OK : HttpStatusCode.Conflict;
                var resp = req.CreateResponse(status);
                await resp.WriteAsJsonAsync(result);
                return resp;
            }
            catch (Exception ex) { return await HandleException(req, ex); }
        }

        // ---------- members / reassignment ----------

        [Function("CampaignAdmin_GetMembers")]
        public async Task<HttpResponseData> GetMembers(
            [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "campaignadmin/{campaignId:guid}/members")] HttpRequestData req,
            Guid campaignId)
        {
            var userId = Authorize(req);
            if (userId == null) return req.CreateResponse(HttpStatusCode.Unauthorized);

            try
            {
                var result = await _admin.GetCampaignMembers(userId.Value, campaignId);
                var ok = req.CreateResponse(HttpStatusCode.OK);
                await ok.WriteAsJsonAsync(result);
                return ok;
            }
            catch (Exception ex) { return await HandleException(req, ex); }
        }

        [Function("CampaignAdmin_ReassignMember")]
        public async Task<HttpResponseData> ReassignMember(
            [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "campaignadmin/{campaignId:guid}/reassign")] HttpRequestData req,
            Guid campaignId)
        {
            var userId = Authorize(req);
            if (userId == null) return req.CreateResponse(HttpStatusCode.Unauthorized);

            ReassignMemberRequest body;
            try { body = await ReadBody<ReassignMemberRequest>(req); }
            catch { return await BadJson(req); }
            if (body == null) return await BadJson(req);

            try
            {
                await _admin.ReassignMember(userId.Value, campaignId, body);
                var ok = req.CreateResponse(HttpStatusCode.OK);
                await ok.WriteAsJsonAsync(new { reassigned = true });
                return ok;
            }
            catch (Exception ex) { return await HandleException(req, ex); }
        }

        // ---------- helpers ----------

        private static async Task<T> ReadBody<T>(HttpRequestData req)
        {
            using var reader = new StreamReader(req.Body);
            var json = await reader.ReadToEndAsync();
            return JsonSerializer.Deserialize<T>(json, JsonOpts);
        }

        private static async Task<HttpResponseData> BadJson(HttpRequestData req)
        {
            var bad = req.CreateResponse(HttpStatusCode.BadRequest);
            await bad.WriteAsJsonAsync(new { error = "Invalid request body." });
            return bad;
        }

        private async Task<HttpResponseData> HandleException(HttpRequestData req, Exception ex)
        {
            switch (ex)
            {
                case RankConflictException rce:
                    var conflict = req.CreateResponse(HttpStatusCode.Conflict);
                    await conflict.WriteAsJsonAsync(new
                    {
                        error = rce.Message,
                        rankConflict = new { hierarchy = rce.Hierarchy, personaName = rce.ExistingPersonaName }
                    });
                    return conflict;

                case UnauthorizedAccessException:
                    var forbidden = req.CreateResponse(HttpStatusCode.Forbidden);
                    await forbidden.WriteAsJsonAsync(new { error = ex.Message });
                    return forbidden;

                case ArgumentException:
                case InvalidOperationException:
                    var bad = req.CreateResponse(HttpStatusCode.BadRequest);
                    await bad.WriteAsJsonAsync(new { error = ex.Message });
                    return bad;

                default:
                    _log.LogError(ex, "Unhandled error in persona admin endpoint.");
                    var err = req.CreateResponse(HttpStatusCode.InternalServerError);
                    await err.WriteAsJsonAsync(new { error = "An unexpected error occurred." });
                    return err;
            }
        }

        // ---------- auth (mirrors Campaigns.cs / Authentication.cs) ----------

        private static Guid? Authorize(HttpRequestData req)
        {
            var principal = ValidateJwt(req);
            if (principal == null) return null;
            var idStr = principal.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            return Guid.TryParse(idStr, out var id) ? id : (Guid?)null;
        }

        private static ClaimsPrincipal ValidateJwt(HttpRequestData req)
        {
            string token = null;

            if (req.Headers.TryGetValues("X-Ender-Auth", out var xauthHeaders))
                token = xauthHeaders.FirstOrDefault();

            if (string.IsNullOrWhiteSpace(token) && req.Headers.TryGetValues("Authorization", out var authHeaders))
            {
                var auth = authHeaders.FirstOrDefault();
                if (!string.IsNullOrWhiteSpace(auth) && auth.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
                    token = auth.Substring("Bearer ".Length).Trim();
            }

            if (!string.IsNullOrWhiteSpace(token) && token.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
                token = token.Substring("Bearer ".Length).Trim();

            if (string.IsNullOrWhiteSpace(token)) return null;

            var secret = Environment.GetEnvironmentVariable("JwtSecret");
            if (string.IsNullOrWhiteSpace(secret) || secret.Length < 32) return null;

            try
            {
                var handler = new JwtSecurityTokenHandler();
                return handler.ValidateToken(token, new TokenValidationParameters
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
            }
            catch
            {
                return null;
            }
        }
    }
}
