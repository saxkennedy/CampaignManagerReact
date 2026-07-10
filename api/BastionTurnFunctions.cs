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
    /// Phase B of the bastion turn system: a DM issues per-bastion "turn segments"
    /// (N turns, D days, L long-rests/day) to selected characters, may edit them while
    /// Open, and later Concludes them. Budgets are per-character; spending against them
    /// (activities) is Phase C. DM = a campaign persona holding <see cref="DmPermission"/>.
    /// </summary>
    public class BastionTurnFunctions
    {
        private const string DmPermission = "CanManagePersonas";
        private const string StatusOpen = "Open";
        private const string StatusConcluded = "Concluded";

        private readonly CampaignManagerContext _db;
        private readonly ILogger<BastionTurnFunctions> _log;

        public BastionTurnFunctions(CampaignManagerContext db, ILogger<BastionTurnFunctions> log)
        {
            _db = db;
            _log = log;
        }

        private static readonly JsonSerializerOptions JsonOpts = new() { PropertyNameCaseInsensitive = true };

        // ---------- request DTOs ----------
        private sealed class SegmentUpsertRequest
        {
            public string? Title { get; set; }
            public int? TurnsGranted { get; set; }
            public int? DaysGranted { get; set; }
            public int? LongRestsPerDay { get; set; }
            public string? Notes { get; set; }
            public List<Guid>? CharacterIds { get; set; } // explicit character set (null = leave unchanged on edit)
            public bool IncludeAllActive { get; set; }      // include every active character in the campaign
        }

        // ============================ LIST ============================
        // GET /api/bastions/{bastionId}/turn-segments   (any campaign member)
        [Function("TurnSegments_List")]
        public async Task<HttpResponseData> List(
            [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "bastions/{bastionId:guid}/turn-segments")] HttpRequestData req,
            Guid bastionId)
        {
            var userId = Authenticate(req);
            if (userId == null) return req.CreateResponse(HttpStatusCode.Unauthorized);

            var campaignId = await CampaignIdForBastionAsync(bastionId);
            if (campaignId == null) return req.CreateResponse(HttpStatusCode.NotFound);

            var isDm = await IsCampaignDmAsync(userId.Value, campaignId.Value);
            if (!isDm && !await IsCampaignMemberAsync(userId.Value, campaignId.Value))
                return await Json(req, HttpStatusCode.Forbidden, new { error = "You are not a member of this campaign." });

            var segments = await LoadSegmentsAsync(s => s.BastionId == bastionId);
            return await Json(req, HttpStatusCode.OK, new { canManage = isDm, myUserId = userId.Value, segments });
        }

        // ============================ CREATE ============================
        // POST /api/bastions/{bastionId}/turn-segments   (DM only)
        [Function("TurnSegments_Create")]
        public async Task<HttpResponseData> Create(
            [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "bastions/{bastionId:guid}/turn-segments")] HttpRequestData req,
            Guid bastionId)
        {
            var userId = Authenticate(req);
            if (userId == null) return req.CreateResponse(HttpStatusCode.Unauthorized);

            var campaignId = await CampaignIdForBastionAsync(bastionId);
            if (campaignId == null) return req.CreateResponse(HttpStatusCode.NotFound);

            if (!await IsCampaignDmAsync(userId.Value, campaignId.Value))
                return await Json(req, HttpStatusCode.Forbidden, new { error = "Only a campaign DM can issue turn segments." });

            // A bastion may have at most one Open segment at a time.
            if (await _db.BastionTurnSegments.AnyAsync(s => s.BastionId == bastionId && s.Status == StatusOpen))
                return await Json(req, HttpStatusCode.Conflict, new { error = "This bastion already has an open segment. Conclude it before issuing a new one." });

            var body = await ReadJson<SegmentUpsertRequest>(req);
            if (body == null) return await Json(req, HttpStatusCode.BadRequest, new { error = "Invalid body." });

            var segment = new BastionTurnSegment
            {
                BastionId = bastionId,
                IssuedByUserId = userId.Value,
                Title = string.IsNullOrWhiteSpace(body.Title) ? null : body.Title.Trim(),
                TurnsGranted = Math.Max(0, body.TurnsGranted ?? 0),
                DaysGranted = Math.Max(0, body.DaysGranted ?? 0),
                LongRestsPerDay = (byte)Clamp(body.LongRestsPerDay ?? 2, 0, 2),
                Notes = string.IsNullOrWhiteSpace(body.Notes) ? null : body.Notes.Trim(),
                Status = StatusOpen,
                // Id + DateIssued from DB defaults.
            };
            _db.BastionTurnSegments.Add(segment);

            var ids = await ResolveCharacterIdsAsync(bastionId, campaignId.Value, body);
            foreach (var cid in ids)
                _db.BastionTurnSegmentCharacters.Add(new BastionTurnSegmentCharacter { Segment = segment, CharacterId = cid });

            await _db.SaveChangesAsync();
            return await Json(req, HttpStatusCode.OK, await ProjectSegmentAsync(segment.Id));
        }

        // ============================ UPDATE (Open only) ============================
        // PUT /api/turn-segments/{segmentId}   (DM only)
        [Function("TurnSegments_Update")]
        public async Task<HttpResponseData> Update(
            [HttpTrigger(AuthorizationLevel.Anonymous, "put", Route = "turn-segments/{segmentId:guid}")] HttpRequestData req,
            Guid segmentId)
        {
            var (userId, segment, campaignId, err) = await LoadForManageAsync(req, segmentId);
            if (err != null) return err;

            if (segment!.Status == StatusConcluded)
                return await Json(req, HttpStatusCode.Conflict, new { error = "This segment is concluded. Reopen it to edit." });

            var body = await ReadJson<SegmentUpsertRequest>(req);
            if (body == null) return await Json(req, HttpStatusCode.BadRequest, new { error = "Invalid body." });

            if (body.Title != null) segment.Title = string.IsNullOrWhiteSpace(body.Title) ? null : body.Title.Trim();
            if (body.Notes != null) segment.Notes = string.IsNullOrWhiteSpace(body.Notes) ? null : body.Notes.Trim();
            if (body.TurnsGranted.HasValue) segment.TurnsGranted = Math.Max(0, body.TurnsGranted.Value);
            if (body.DaysGranted.HasValue) segment.DaysGranted = Math.Max(0, body.DaysGranted.Value);
            if (body.LongRestsPerDay.HasValue) segment.LongRestsPerDay = (byte)Clamp(body.LongRestsPerDay.Value, 0, 2);

            // Replace the character set only when the client actually specifies one.
            if (body.IncludeAllActive || body.CharacterIds != null)
            {
                var want = await ResolveCharacterIdsAsync(segment.BastionId, campaignId!.Value, body);
                var wantSet = want.ToHashSet();
                var existing = await _db.BastionTurnSegmentCharacters.Where(x => x.SegmentId == segmentId).ToListAsync();
                foreach (var ex in existing)
                    if (!wantSet.Contains(ex.CharacterId)) _db.BastionTurnSegmentCharacters.Remove(ex);
                var have = existing.Select(x => x.CharacterId).ToHashSet();
                foreach (var cid in want)
                    if (!have.Contains(cid))
                        _db.BastionTurnSegmentCharacters.Add(new BastionTurnSegmentCharacter { SegmentId = segmentId, CharacterId = cid });
            }

            await _db.SaveChangesAsync();
            return await Json(req, HttpStatusCode.OK, await ProjectSegmentAsync(segmentId));
        }

        // ============================ CONCLUDE / REOPEN ============================
        // POST /api/turn-segments/{segmentId}/conclude   (DM only)
        [Function("TurnSegments_Conclude")]
        public async Task<HttpResponseData> Conclude(
            [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "turn-segments/{segmentId:guid}/conclude")] HttpRequestData req,
            Guid segmentId)
        {
            var (userId, segment, campaignId, err) = await LoadForManageAsync(req, segmentId);
            if (err != null) return err;

            if (segment!.Status != StatusConcluded)
            {
                segment.Status = StatusConcluded;
                segment.DateConcluded = DateTime.UtcNow;
                await _db.SaveChangesAsync();
            }
            return await Json(req, HttpStatusCode.OK, await ProjectSegmentAsync(segmentId));
        }

        // POST /api/turn-segments/{segmentId}/reopen   (DM only)
        [Function("TurnSegments_Reopen")]
        public async Task<HttpResponseData> Reopen(
            [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "turn-segments/{segmentId:guid}/reopen")] HttpRequestData req,
            Guid segmentId)
        {
            var (userId, segment, campaignId, err) = await LoadForManageAsync(req, segmentId);
            if (err != null) return err;

            if (segment!.Status != StatusOpen)
            {
                if (await _db.BastionTurnSegments.AnyAsync(s => s.BastionId == segment.BastionId && s.Status == StatusOpen && s.Id != segmentId))
                    return await Json(req, HttpStatusCode.Conflict, new { error = "This bastion already has an open segment. Conclude it first." });
                segment.Status = StatusOpen;
                segment.DateConcluded = null;
                await _db.SaveChangesAsync();
            }
            return await Json(req, HttpStatusCode.OK, await ProjectSegmentAsync(segmentId));
        }

        // ============================ DELETE ============================
        // DELETE /api/turn-segments/{segmentId}   (DM only; cascade drops character rows)
        [Function("TurnSegments_Delete")]
        public async Task<HttpResponseData> Delete(
            [HttpTrigger(AuthorizationLevel.Anonymous, "delete", Route = "turn-segments/{segmentId:guid}")] HttpRequestData req,
            Guid segmentId)
        {
            var (userId, segment, campaignId, err) = await LoadForManageAsync(req, segmentId);
            if (err != null) return err;

            _db.BastionTurnSegments.Remove(segment!);
            await _db.SaveChangesAsync();
            return await Json(req, HttpStatusCode.OK, new { deleted = true });
        }

        // ---------- shared load + auth for manage endpoints ----------
        private async Task<(Guid? userId, BastionTurnSegment? segment, Guid? campaignId, HttpResponseData? error)>
            LoadForManageAsync(HttpRequestData req, Guid segmentId)
        {
            var userId = Authenticate(req);
            if (userId == null) return (null, null, null, req.CreateResponse(HttpStatusCode.Unauthorized));

            var segment = await _db.BastionTurnSegments.FirstOrDefaultAsync(s => s.Id == segmentId);
            if (segment == null) return (userId, null, null, req.CreateResponse(HttpStatusCode.NotFound));

            var campaignId = await CampaignIdForBastionAsync(segment.BastionId);
            if (campaignId == null) return (userId, segment, null, req.CreateResponse(HttpStatusCode.NotFound));

            if (!await IsCampaignDmAsync(userId.Value, campaignId.Value))
                return (userId, segment, campaignId,
                    await Json(req, HttpStatusCode.Forbidden, new { error = "Only a campaign DM can manage turn segments." }));

            return (userId, segment, campaignId, null);
        }

        // Characters to include, drawn from the ones ASSIGNED to this bastion: all of them,
        // or the validated explicit subset.
        private async Task<List<Guid>> ResolveCharacterIdsAsync(Guid bastionId, Guid campaignId, SegmentUpsertRequest body)
        {
            var assigned = _db.BastionCharacters.AsNoTracking()
                .Where(bc => bc.BastionId == bastionId)
                .Join(_db.Characters, bc => bc.CharacterId, c => c.Id, (bc, c) => c)
                .Where(c => c.IsActive);

            if (body.IncludeAllActive)
                return await assigned.Select(c => c.Id).ToListAsync();

            if (body.CharacterIds is { Count: > 0 })
            {
                var wanted = body.CharacterIds.Distinct().ToList();
                return await assigned.Where(c => wanted.Contains(c.Id)).Select(c => c.Id).ToListAsync();
            }
            return new List<Guid>();
        }

        // ---------- projection ----------
        private async Task<List<object>> LoadSegmentsAsync(System.Linq.Expressions.Expression<Func<BastionTurnSegment, bool>> where)
        {
            var segments = await _db.BastionTurnSegments.AsNoTracking()
                .Where(where)
                .OrderByDescending(s => s.DateIssued)
                .Select(s => new
                {
                    s.Id,
                    s.BastionId,
                    s.Title,
                    s.TurnsGranted,
                    s.DaysGranted,
                    s.LongRestsPerDay,
                    s.Status,
                    s.Notes,
                    s.IssuedByUserId,
                    s.DateIssued,
                    s.DateConcluded,
                }).ToListAsync();

            var ids = segments.Select(s => s.Id).ToList();
            var chars = await (
                from sc in _db.BastionTurnSegmentCharacters.AsNoTracking()
                where ids.Contains(sc.SegmentId)
                join c in _db.Characters on sc.CharacterId equals c.Id
                join u in _db.Users on c.UserId equals u.Id into gu
                from u in gu.DefaultIfEmpty()
                select new
                {
                    sc.SegmentId,
                    characterId = c.Id,
                    name = c.Name,
                    isActive = c.IsActive,
                    ownerUserId = c.UserId,
                    ownerFirstName = u != null ? u.FirstName : null,
                    ownerLastName = u != null ? u.LastName : null,
                    ownerEmail = u != null ? u.Email : null,
                }).ToListAsync();

            var bySeg = chars.GroupBy(c => c.SegmentId).ToDictionary(g => g.Key, g => g.ToList());

            return segments.Select(s => (object)new
            {
                id = s.Id,
                bastionId = s.BastionId,
                title = s.Title,
                turnsGranted = s.TurnsGranted,
                daysGranted = s.DaysGranted,
                longRestsPerDay = s.LongRestsPerDay,
                longRestsTotal = s.DaysGranted * s.LongRestsPerDay, // per-character rest budget
                status = s.Status,
                notes = s.Notes,
                issuedByUserId = s.IssuedByUserId,
                dateIssued = s.DateIssued,
                dateConcluded = s.DateConcluded,
                characters = bySeg.TryGetValue(s.Id, out var list)
                    ? list.Select(c => new
                    {
                        c.characterId,
                        c.name,
                        c.isActive,
                        c.ownerUserId,
                        c.ownerFirstName,
                        c.ownerLastName,
                        c.ownerEmail,
                    }).OrderBy(c => c.name).ToList<object>()
                    : new List<object>(),
            }).ToList();
        }

        private async Task<object> ProjectSegmentAsync(Guid segmentId)
        {
            var list = await LoadSegmentsAsync(s => s.Id == segmentId);
            return list.FirstOrDefault() ?? new { };
        }

        // ---------- authorization / lookups ----------
        private async Task<Guid?> CampaignIdForBastionAsync(Guid bastionId) =>
            await _db.CampaignBastions.AsNoTracking()
                .Where(b => b.Id == bastionId).Select(b => (Guid?)b.CampaignId).FirstOrDefaultAsync();

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

        private static int Clamp(int v, int min, int max) => v < min ? min : (v > max ? max : v);

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
