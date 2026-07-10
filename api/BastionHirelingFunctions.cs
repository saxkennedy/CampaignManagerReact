using System;
using System.Collections.Generic;
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
    /// Phase C: hirelings are a CAMPAIGN-scoped pool. Each hireling belongs to a campaign
    /// and is optionally assigned to a room (BastionRoomId = null ⇒ in the pool). Viewing
    /// needs campaign membership (or bastion Read for the room view); creating / editing /
    /// assigning / deleting needs the DM (<see cref="DmPermission"/>).
    /// </summary>
    public class BastionHirelingFunctions
    {
        private const string DmPermission = "CanManagePersonas";
        private const byte AccessNone = 0, AccessRead = 1;

        private readonly CampaignManagerContext _db;
        private readonly ILogger<BastionHirelingFunctions> _log;

        public BastionHirelingFunctions(CampaignManagerContext db, ILogger<BastionHirelingFunctions> log)
        {
            _db = db;
            _log = log;
        }

        private static readonly JsonSerializerOptions JsonOpts = new() { PropertyNameCaseInsensitive = true };

        private sealed class HirelingRequest
        {
            public string? Name { get; set; }
            public string? Role { get; set; }
            public string? Notes { get; set; }
            public bool? IsAbsent { get; set; }
            public int? SortOrder { get; set; }
            public Guid? BastionRoomId { get; set; }  // assign to a room
            public bool Unassign { get; set; }         // send back to the pool
        }

        // ============================ CAMPAIGN LIST ============================
        // GET /api/campaigns/{campaignId}/hirelings   (campaign member)
        [Function("Hirelings_CampaignList")]
        public async Task<HttpResponseData> CampaignList(
            [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "campaigns/{campaignId:guid}/hirelings")] HttpRequestData req,
            Guid campaignId)
        {
            var userId = Authenticate(req);
            if (userId == null) return req.CreateResponse(HttpStatusCode.Unauthorized);

            var isDm = await IsCampaignDmAsync(userId.Value, campaignId);
            if (!isDm && !await IsCampaignMemberAsync(userId.Value, campaignId))
                return await Json(req, HttpStatusCode.Forbidden, new { error = "You are not a member of this campaign." });

            var hirelings = await LoadCampaignHirelingsAsync(campaignId);
            return await Json(req, HttpStatusCode.OK, new { canManage = isDm, hirelings });
        }

        // ============================ CAMPAIGN CREATE ============================
        // POST /api/campaigns/{campaignId}/hirelings   (DM)
        [Function("Hirelings_Create")]
        public async Task<HttpResponseData> Create(
            [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "campaigns/{campaignId:guid}/hirelings")] HttpRequestData req,
            Guid campaignId)
        {
            var userId = Authenticate(req);
            if (userId == null) return req.CreateResponse(HttpStatusCode.Unauthorized);
            if (!await IsCampaignDmAsync(userId.Value, campaignId))
                return await Json(req, HttpStatusCode.Forbidden, new { error = "Only a campaign DM can manage hirelings." });

            var body = await ReadJson<HirelingRequest>(req);
            var name = body?.Name?.Trim();
            if (string.IsNullOrEmpty(name))
                return await Json(req, HttpStatusCode.BadRequest, new { error = "Name is required." });

            if (body!.BastionRoomId.HasValue && !await RoomInCampaignAsync(body.BastionRoomId.Value, campaignId))
                return await Json(req, HttpStatusCode.BadRequest, new { error = "That room isn't in this campaign." });

            var maxSort = await _db.BastionHirelings.Where(h => h.CampaignId == campaignId)
                .Select(h => (int?)h.SortOrder).MaxAsync() ?? -1;

            var hireling = new BastionHireling
            {
                CampaignId = campaignId,
                BastionRoomId = body.BastionRoomId,
                Name = name,
                Role = string.IsNullOrWhiteSpace(body.Role) ? null : body.Role.Trim(),
                Notes = string.IsNullOrWhiteSpace(body.Notes) ? null : body.Notes.Trim(),
                IsAbsent = body.IsAbsent ?? false,
                SortOrder = maxSort + 1,
            };
            _db.BastionHirelings.Add(hireling);
            await _db.SaveChangesAsync();
            return await Json(req, HttpStatusCode.OK, await ProjectAsync(hireling.Id));
        }

        // ============================ ROOM LIST ============================
        // GET /api/bastion-rooms/{roomId}/hirelings   (bastion Read; room-assigned only)
        [Function("Hirelings_RoomList")]
        public async Task<HttpResponseData> RoomList(
            [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "bastion-rooms/{roomId:guid}/hirelings")] HttpRequestData req,
            Guid roomId)
        {
            var userId = Authenticate(req);
            if (userId == null) return req.CreateResponse(HttpStatusCode.Unauthorized);

            var room = await RoomInfoAsync(roomId);
            if (room == null) return req.CreateResponse(HttpStatusCode.NotFound);

            var isDm = await IsCampaignDmAsync(userId.Value, room.CampaignId);
            var access = isDm ? (byte)3 : await BastionAccessAsync(userId.Value, room.BastionId);
            if (access < AccessRead) return await Json(req, HttpStatusCode.Forbidden, new { error = "You don't have access to this bastion." });

            var hirelings = await LoadRoomHirelingsAsync(roomId);
            return await Json(req, HttpStatusCode.OK, new { canManage = isDm, hirelings });
        }

        // ============================ UPDATE / ASSIGN ============================
        // PUT /api/hirelings/{hirelingId}   (DM)
        [Function("Hirelings_Update")]
        public async Task<HttpResponseData> Update(
            [HttpTrigger(AuthorizationLevel.Anonymous, "put", Route = "hirelings/{hirelingId:guid}")] HttpRequestData req,
            Guid hirelingId)
        {
            var userId = Authenticate(req);
            if (userId == null) return req.CreateResponse(HttpStatusCode.Unauthorized);

            var hireling = await _db.BastionHirelings.FirstOrDefaultAsync(h => h.Id == hirelingId);
            if (hireling == null) return req.CreateResponse(HttpStatusCode.NotFound);
            if (!await IsCampaignDmAsync(userId.Value, hireling.CampaignId))
                return await Json(req, HttpStatusCode.Forbidden, new { error = "Only a campaign DM can manage hirelings." });

            var body = await ReadJson<HirelingRequest>(req);
            if (body == null) return await Json(req, HttpStatusCode.BadRequest, new { error = "Invalid body." });

            if (body.Name != null)
            {
                var n = body.Name.Trim();
                if (n.Length == 0) return await Json(req, HttpStatusCode.BadRequest, new { error = "Name can't be empty." });
                hireling.Name = n;
            }
            if (body.Role != null) hireling.Role = string.IsNullOrWhiteSpace(body.Role) ? null : body.Role.Trim();
            if (body.Notes != null) hireling.Notes = string.IsNullOrWhiteSpace(body.Notes) ? null : body.Notes.Trim();
            if (body.IsAbsent.HasValue) hireling.IsAbsent = body.IsAbsent.Value;
            if (body.SortOrder.HasValue) hireling.SortOrder = body.SortOrder.Value;

            if (body.Unassign)
            {
                hireling.BastionRoomId = null;
            }
            else if (body.BastionRoomId.HasValue)
            {
                if (!await RoomInCampaignAsync(body.BastionRoomId.Value, hireling.CampaignId))
                    return await Json(req, HttpStatusCode.BadRequest, new { error = "That room isn't in this campaign." });
                hireling.BastionRoomId = body.BastionRoomId.Value;
            }

            await _db.SaveChangesAsync();
            return await Json(req, HttpStatusCode.OK, await ProjectAsync(hireling.Id));
        }

        // ============================ DELETE ============================
        // DELETE /api/hirelings/{hirelingId}   (DM)
        [Function("Hirelings_Delete")]
        public async Task<HttpResponseData> Delete(
            [HttpTrigger(AuthorizationLevel.Anonymous, "delete", Route = "hirelings/{hirelingId:guid}")] HttpRequestData req,
            Guid hirelingId)
        {
            var userId = Authenticate(req);
            if (userId == null) return req.CreateResponse(HttpStatusCode.Unauthorized);

            var hireling = await _db.BastionHirelings.FirstOrDefaultAsync(h => h.Id == hirelingId);
            if (hireling == null) return req.CreateResponse(HttpStatusCode.NotFound);
            if (!await IsCampaignDmAsync(userId.Value, hireling.CampaignId))
                return await Json(req, HttpStatusCode.Forbidden, new { error = "Only a campaign DM can manage hirelings." });

            // Clear activity assignments first (that FK is NO ACTION).
            var assigns = await _db.BastionActivityHirelings.Where(a => a.BastionHirelingId == hirelingId).ToListAsync();
            if (assigns.Count > 0) _db.BastionActivityHirelings.RemoveRange(assigns);

            _db.BastionHirelings.Remove(hireling);
            await _db.SaveChangesAsync();
            return await Json(req, HttpStatusCode.OK, new { deleted = true });
        }

        // ---------- loaders ----------
        private async Task<List<object>> LoadCampaignHirelingsAsync(Guid campaignId)
        {
            var hs = await _db.BastionHirelings.AsNoTracking()
                .Where(h => h.CampaignId == campaignId)
                .OrderBy(h => h.SortOrder).ThenBy(h => h.Name)
                .Select(h => new { h.Id, h.Name, h.Role, h.Notes, h.IsAbsent, h.SortOrder, h.BastionRoomId })
                .ToListAsync();

            var roomIds = hs.Where(h => h.BastionRoomId != null).Select(h => h.BastionRoomId!.Value).Distinct().ToList();
            var rooms = await _db.BastionRooms.AsNoTracking().Where(r => roomIds.Contains(r.Id))
                .Select(r => new { r.Id, r.Name, r.BastionId }).ToListAsync();
            var bastIds = rooms.Select(r => r.BastionId).Distinct().ToList();
            var basts = await _db.CampaignBastions.AsNoTracking().Where(b => bastIds.Contains(b.Id))
                .Select(b => new { b.Id, b.Name }).ToListAsync();
            var roomById = rooms.ToDictionary(r => r.Id);
            var bastById = basts.ToDictionary(b => b.Id);

            return hs.Select(h =>
            {
                object? roomName = null, bastionId = null, bastionName = null;
                if (h.BastionRoomId != null && roomById.TryGetValue(h.BastionRoomId.Value, out var r))
                {
                    roomName = r.Name; bastionId = r.BastionId;
                    if (bastById.TryGetValue(r.BastionId, out var b)) bastionName = b.Name;
                }
                return (object)new
                {
                    id = h.Id,
                    name = h.Name,
                    role = h.Role,
                    notes = h.Notes,
                    isAbsent = h.IsAbsent,
                    sortOrder = h.SortOrder,
                    bastionRoomId = h.BastionRoomId,
                    roomName,
                    bastionId,
                    bastionName,
                };
            }).ToList();
        }

        private async Task<object> LoadRoomHirelingsAsync(Guid roomId) =>
            await _db.BastionHirelings.AsNoTracking()
                .Where(h => h.BastionRoomId == roomId)
                .OrderBy(h => h.SortOrder).ThenBy(h => h.Name)
                .Select(h => new { id = h.Id, name = h.Name, role = h.Role, notes = h.Notes, isAbsent = h.IsAbsent, sortOrder = h.SortOrder, bastionRoomId = h.BastionRoomId })
                .ToListAsync();

        private async Task<object> ProjectAsync(Guid hirelingId)
        {
            var h = await _db.BastionHirelings.AsNoTracking().Where(x => x.Id == hirelingId)
                .Select(x => new { x.Id, x.Name, x.Role, x.Notes, x.IsAbsent, x.SortOrder, x.BastionRoomId }).FirstAsync();
            string? roomName = null; Guid? bastionId = null; string? bastionName = null;
            if (h.BastionRoomId != null)
            {
                var r = await _db.BastionRooms.AsNoTracking().Where(x => x.Id == h.BastionRoomId)
                    .Select(x => new { x.Name, x.BastionId }).FirstOrDefaultAsync();
                if (r != null)
                {
                    roomName = r.Name; bastionId = r.BastionId;
                    bastionName = await _db.CampaignBastions.AsNoTracking().Where(b => b.Id == r.BastionId).Select(b => b.Name).FirstOrDefaultAsync();
                }
            }
            return new { id = h.Id, name = h.Name, role = h.Role, notes = h.Notes, isAbsent = h.IsAbsent, sortOrder = h.SortOrder, bastionRoomId = h.BastionRoomId, roomName, bastionId, bastionName };
        }

        private sealed record RoomInfo(Guid RoomId, Guid BastionId, Guid CampaignId);

        private async Task<RoomInfo?> RoomInfoAsync(Guid roomId) =>
            await _db.BastionRooms.AsNoTracking()
                .Where(r => r.Id == roomId)
                .Select(r => new RoomInfo(r.Id, r.BastionId, r.Bastion.CampaignId))
                .FirstOrDefaultAsync();

        private async Task<bool> RoomInCampaignAsync(Guid roomId, Guid campaignId) =>
            await _db.BastionRooms.AsNoTracking().AnyAsync(r => r.Id == roomId && r.Bastion.CampaignId == campaignId);

        // ---------- authorization ----------
        private async Task<byte> BastionAccessAsync(Guid userId, Guid bastionId)
        {
            var ub = await _db.UserBastions.AsNoTracking()
                .FirstOrDefaultAsync(x => x.BastionId == bastionId && x.UserId == userId);
            return ub?.BastionAccessLevelId ?? AccessNone;
        }

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
