using System;
using System.IO;
using System.Linq;
using System.Net;
using System.Security.Claims;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using Data.Models;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;

namespace api
{
    /// <summary>
    /// Phase A of the bastion turn system: campaign-scoped Characters (PCs) and the
    /// player↔character relationship. A campaign "DM" (a member whose persona holds
    /// <see cref="DmPermission"/>) manages every character; a player may edit the name/notes
    /// of a character they own. Later phases (turn segments, activities) reference these rows.
    /// </summary>
    public class CharacterFunctions
    {
        // A campaign persona holding this permission is treated as the campaign DM / manager.
        private const string DmPermission = "CanManagePersonas";

        private readonly CampaignManagerContext _db;
        private readonly ILogger<CharacterFunctions> _log;

        public CharacterFunctions(CampaignManagerContext db, ILogger<CharacterFunctions> log)
        {
            _db = db;
            _log = log;
        }

        private static readonly JsonSerializerOptions JsonOpts = new() { PropertyNameCaseInsensitive = true };

        // ---------- request DTOs ----------
        private sealed class CreateCharacterRequest
        {
            public string? Name { get; set; }
            public string? Notes { get; set; }
            public Guid? UserId { get; set; }   // owning player; null = unassigned
        }

        private sealed class UpdateCharacterRequest
        {
            public string? Name { get; set; }
            public string? Notes { get; set; }
            public bool? IsActive { get; set; }
            public int? SortOrder { get; set; }
            public Guid? UserId { get; set; }   // DM-only reassignment
            public bool UnassignOwner { get; set; }  // DM-only: explicitly clear the owner
        }

        // ============================ LIST ============================
        // GET /api/campaigns/{campaignId}/characters   (any campaign member)
        [Function("Characters_List")]
        public async Task<HttpResponseData> List(
            [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "campaigns/{campaignId:guid}/characters")] HttpRequestData req,
            Guid campaignId)
        {
            var userId = Authenticate(req);
            if (userId == null) return req.CreateResponse(HttpStatusCode.Unauthorized);

            var isDm = await IsCampaignDmAsync(userId.Value, campaignId);
            if (!isDm && !await IsCampaignMemberAsync(userId.Value, campaignId))
                return await Json(req, HttpStatusCode.Forbidden, new { error = "You are not a member of this campaign." });

            var rows = await (
                from c in _db.Characters.AsNoTracking()
                where c.CampaignId == campaignId
                join u in _db.Users on c.UserId equals u.Id into gu
                from u in gu.DefaultIfEmpty()
                orderby c.SortOrder, c.Name
                select new
                {
                    id = c.Id,
                    name = c.Name,
                    notes = c.Notes,
                    isActive = c.IsActive,
                    sortOrder = c.SortOrder,
                    userId = c.UserId,
                    ownerFirstName = u != null ? u.FirstName : null,
                    ownerLastName = u != null ? u.LastName : null,
                    ownerEmail = u != null ? u.Email : null,
                }).ToListAsync();

            return await Json(req, HttpStatusCode.OK, new { canManage = isDm, myUserId = userId.Value, characters = rows });
        }

        // ============================ CREATE ============================
        // POST /api/campaigns/{campaignId}/characters   (DM only)
        [Function("Characters_Create")]
        public async Task<HttpResponseData> Create(
            [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "campaigns/{campaignId:guid}/characters")] HttpRequestData req,
            Guid campaignId)
        {
            var userId = Authenticate(req);
            if (userId == null) return req.CreateResponse(HttpStatusCode.Unauthorized);

            if (!await IsCampaignDmAsync(userId.Value, campaignId))
                return await Json(req, HttpStatusCode.Forbidden, new { error = "Only a campaign DM can create characters." });

            var body = await ReadJson<CreateCharacterRequest>(req);
            var name = body?.Name?.Trim();
            if (string.IsNullOrEmpty(name))
                return await Json(req, HttpStatusCode.BadRequest, new { error = "Name is required." });

            if (body!.UserId.HasValue && !await IsCampaignMemberAsync(body.UserId.Value, campaignId))
                return await Json(req, HttpStatusCode.BadRequest, new { error = "That player is not a member of this campaign." });

            var maxSort = await _db.Characters.Where(c => c.CampaignId == campaignId)
                .Select(c => (int?)c.SortOrder).MaxAsync() ?? -1;

            var character = new Character
            {
                CampaignId = campaignId,
                UserId = body.UserId,
                Name = name,
                Notes = string.IsNullOrWhiteSpace(body.Notes) ? null : body.Notes.Trim(),
                IsActive = true,
                SortOrder = maxSort + 1,
                // Id + DateAdded from DB defaults.
            };
            _db.Characters.Add(character);
            await _db.SaveChangesAsync();

            return await Json(req, HttpStatusCode.OK, await ProjectAsync(character.Id));
        }

        // ============================ UPDATE ============================
        // PUT /api/characters/{characterId}   (DM: anything; owner: own name/notes)
        [Function("Characters_Update")]
        public async Task<HttpResponseData> Update(
            [HttpTrigger(AuthorizationLevel.Anonymous, "put", Route = "characters/{characterId:guid}")] HttpRequestData req,
            Guid characterId)
        {
            var userId = Authenticate(req);
            if (userId == null) return req.CreateResponse(HttpStatusCode.Unauthorized);

            var character = await _db.Characters.FirstOrDefaultAsync(c => c.Id == characterId);
            if (character == null) return req.CreateResponse(HttpStatusCode.NotFound);

            var isDm = await IsCampaignDmAsync(userId.Value, character.CampaignId);
            var isOwner = character.UserId == userId.Value;
            if (!isDm && !isOwner)
                return await Json(req, HttpStatusCode.Forbidden, new { error = "You can't edit this character." });

            var body = await ReadJson<UpdateCharacterRequest>(req);
            if (body == null) return await Json(req, HttpStatusCode.BadRequest, new { error = "Invalid body." });

            if (body.Name != null)
            {
                var n = body.Name.Trim();
                if (n.Length == 0) return await Json(req, HttpStatusCode.BadRequest, new { error = "Name can't be empty." });
                character.Name = n;
            }
            if (body.Notes != null)
                character.Notes = string.IsNullOrWhiteSpace(body.Notes) ? null : body.Notes.Trim();

            // DM-only fields.
            if (isDm)
            {
                if (body.IsActive.HasValue) character.IsActive = body.IsActive.Value;
                if (body.SortOrder.HasValue) character.SortOrder = body.SortOrder.Value;
                if (body.UnassignOwner)
                {
                    character.UserId = null;
                }
                else if (body.UserId.HasValue)
                {
                    if (!await IsCampaignMemberAsync(body.UserId.Value, character.CampaignId))
                        return await Json(req, HttpStatusCode.BadRequest, new { error = "That player is not a member of this campaign." });
                    character.UserId = body.UserId.Value;
                }
            }

            await _db.SaveChangesAsync();
            return await Json(req, HttpStatusCode.OK, await ProjectAsync(character.Id));
        }

        // ============================ DELETE ============================
        // DELETE /api/characters/{characterId}   (DM only)
        [Function("Characters_Delete")]
        public async Task<HttpResponseData> Delete(
            [HttpTrigger(AuthorizationLevel.Anonymous, "delete", Route = "characters/{characterId:guid}")] HttpRequestData req,
            Guid characterId)
        {
            var userId = Authenticate(req);
            if (userId == null) return req.CreateResponse(HttpStatusCode.Unauthorized);

            var character = await _db.Characters.FirstOrDefaultAsync(c => c.Id == characterId);
            if (character == null) return req.CreateResponse(HttpStatusCode.NotFound);

            if (!await IsCampaignDmAsync(userId.Value, character.CampaignId))
                return await Json(req, HttpStatusCode.Forbidden, new { error = "Only a campaign DM can delete characters." });

            // Remove segment memberships and activities first — those FKs are NO ACTION (to
            // avoid multiple-cascade-path conflicts), so they would otherwise block the delete.
            var memberships = await _db.BastionTurnSegmentCharacters.Where(x => x.CharacterId == characterId).ToListAsync();
            if (memberships.Count > 0) _db.BastionTurnSegmentCharacters.RemoveRange(memberships);
            var acts = await _db.BastionActivities.Where(a => a.CharacterId == characterId).ToListAsync();
            if (acts.Count > 0) _db.BastionActivities.RemoveRange(acts); // cascade drops activity-hireling links
            var bcs = await _db.BastionCharacters.Where(x => x.CharacterId == characterId).ToListAsync();
            if (bcs.Count > 0) _db.BastionCharacters.RemoveRange(bcs);

            _db.Characters.Remove(character);
            await _db.SaveChangesAsync();
            return await Json(req, HttpStatusCode.OK, new { deleted = true });
        }

        // ---------- projection ----------
        private async Task<object> ProjectAsync(Guid characterId) =>
            await (
                from c in _db.Characters.AsNoTracking()
                where c.Id == characterId
                join u in _db.Users on c.UserId equals u.Id into gu
                from u in gu.DefaultIfEmpty()
                select new
                {
                    id = c.Id,
                    name = c.Name,
                    notes = c.Notes,
                    isActive = c.IsActive,
                    sortOrder = c.SortOrder,
                    userId = c.UserId,
                    ownerFirstName = u != null ? u.FirstName : null,
                    ownerLastName = u != null ? u.LastName : null,
                    ownerEmail = u != null ? u.Email : null,
                }).FirstAsync();

        // ---------- authorization helpers ----------
        private async Task<bool> IsCampaignDmAsync(Guid userId, Guid campaignId)
        {
            return await (
                from ucp in _db.UserCampaignPersonas
                join cp in _db.CampaignPersonas on ucp.CampaignPersonaId equals cp.Id
                join cpp in _db.CampaignPersonaPermissions on cp.Id equals cpp.CampaignPersonaId
                join p in _db.Permissions on cpp.PermissionId equals p.Id
                where ucp.UserId == userId && cp.CampaignId == campaignId && p.DisplayName == DmPermission
                select p.Id
            ).AnyAsync();
        }

        private async Task<bool> IsCampaignMemberAsync(Guid userId, Guid campaignId)
        {
            return await (
                from ucp in _db.UserCampaignPersonas
                join cp in _db.CampaignPersonas on ucp.CampaignPersonaId equals cp.Id
                where ucp.UserId == userId && cp.CampaignId == campaignId
                select ucp.UserId
            ).AnyAsync();
        }

        // ---------- request plumbing ----------
        private static Guid? Authenticate(HttpRequestData req)
        {
            var principal = ValidateJwt(req);
            if (principal == null) return null;
            var idStr = principal.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            return Guid.TryParse(idStr, out var id) ? id : (Guid?)null;
        }

        private static async Task<T?> ReadJson<T>(HttpRequestData req)
        {
            try
            {
                using var reader = new StreamReader(req.Body);
                var s = await reader.ReadToEndAsync();
                if (string.IsNullOrWhiteSpace(s)) return default;
                return JsonSerializer.Deserialize<T>(s, JsonOpts);
            }
            catch
            {
                return default;
            }
        }

        private static async Task<HttpResponseData> Json(HttpRequestData req, HttpStatusCode code, object body)
        {
            var res = req.CreateResponse(code);
            await res.WriteAsJsonAsync(body);
            return res;
        }

        private static ClaimsPrincipal? ValidateJwt(HttpRequestData req)
        {
            string? token = null;

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

            if (string.IsNullOrWhiteSpace(token))
                return null;

            var secret = Environment.GetEnvironmentVariable("JwtSecret");
            if (string.IsNullOrWhiteSpace(secret) || secret.Length < 32)
                return null;

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
