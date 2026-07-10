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
    /// Phase C (slice 2): activities — a character spending an Open segment's banked
    /// turns / long-rests in a facility room. Enforces per-character budgets, per-room
    /// order-slot exclusivity (<c>MaxConcurrentActivities</c>, null ⇒ 1), and day-window
    /// scheduling. Every create/edit/cancel is written to <c>BastionActivityLogs</c>.
    /// A player manages their own character's activities; a DM manages all.
    /// </summary>
    public class BastionActivityFunctions
    {
        private const string DmPermission = "CanManagePersonas";
        private const string StatusOpen = "Open";
        private const string StatusCancelled = "Cancelled";

        private readonly CampaignManagerContext _db;
        private readonly ILogger<BastionActivityFunctions> _log;

        public BastionActivityFunctions(CampaignManagerContext db, ILogger<BastionActivityFunctions> log)
        {
            _db = db;
            _log = log;
        }

        private static readonly JsonSerializerOptions JsonOpts = new() { PropertyNameCaseInsensitive = true };

        private sealed class ActivityRequest
        {
            public Guid? CharacterId { get; set; }
            public Guid? BastionRoomId { get; set; }
            public string? ActionKind { get; set; }   // "order" | "special"
            public string? OrderType { get; set; }
            public string? Title { get; set; }
            public int? TurnsCost { get; set; }
            public int? LongRestsCost { get; set; }
            public int? StartDay { get; set; }
            public int? DurationDays { get; set; }
            public string? Notes { get; set; }
            public string? Status { get; set; }        // DM may set Planned/Completed/Cancelled
            public string? ResultSummary { get; set; }
            public List<Guid>? HirelingIds { get; set; }
        }

        // ============================ LIST ============================
        // GET /api/turn-segments/{segmentId}/activities
        [Function("Activities_List")]
        public async Task<HttpResponseData> List(
            [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "turn-segments/{segmentId:guid}/activities")] HttpRequestData req,
            Guid segmentId)
        {
            var userId = Authenticate(req);
            if (userId == null) return req.CreateResponse(HttpStatusCode.Unauthorized);

            var segment = await _db.BastionTurnSegments.AsNoTracking().FirstOrDefaultAsync(s => s.Id == segmentId);
            if (segment == null) return req.CreateResponse(HttpStatusCode.NotFound);

            var campaignId = await CampaignIdForBastionAsync(segment.BastionId);
            if (campaignId == null) return req.CreateResponse(HttpStatusCode.NotFound);

            var isDm = await IsCampaignDmAsync(userId.Value, campaignId.Value);
            if (!isDm && !await IsCampaignMemberAsync(userId.Value, campaignId.Value))
                return await Json(req, HttpStatusCode.Forbidden, new { error = "You are not a member of this campaign." });

            var activities = await LoadActivitiesAsync(segmentId);
            return await Json(req, HttpStatusCode.OK, new
            {
                canManage = isDm,
                myUserId = userId.Value,
                segment = new { turnsGranted = segment.TurnsGranted, daysGranted = segment.DaysGranted, longRestsPerDay = segment.LongRestsPerDay, status = segment.Status },
                activities
            });
        }

        // ============================ MY ACTIVITIES (history) ============================
        // GET /api/bastions/{bastionId}/my-activities  — the caller's non-cancelled activities
        // across the bastion's segments, grouped by segment (open first).
        [Function("Activities_Mine")]
        public async Task<HttpResponseData> Mine(
            [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "bastions/{bastionId:guid}/my-activities")] HttpRequestData req,
            Guid bastionId)
        {
            var userId = Authenticate(req);
            if (userId == null) return req.CreateResponse(HttpStatusCode.Unauthorized);

            var campaignId = await CampaignIdForBastionAsync(bastionId);
            if (campaignId == null) return req.CreateResponse(HttpStatusCode.NotFound);
            if (!await IsCampaignDmAsync(userId.Value, campaignId.Value) && !await IsCampaignMemberAsync(userId.Value, campaignId.Value))
                return await Json(req, HttpStatusCode.Forbidden, new { error = "You are not a member of this campaign." });

            var segs = await _db.BastionTurnSegments.AsNoTracking()
                .Where(s => s.BastionId == bastionId)
                .OrderByDescending(s => s.Status == "Open").ThenByDescending(s => s.DateIssued)
                .Select(s => new { s.Id, s.Title, s.Status, s.DateIssued })
                .ToListAsync();
            var segIds = segs.Select(s => s.Id).ToList();

            var acts = await (
                from a in _db.BastionActivities.AsNoTracking()
                where segIds.Contains(a.SegmentId) && a.Status != StatusCancelled
                join c in _db.Characters on a.CharacterId equals c.Id
                where c.UserId == userId.Value
                join r in _db.BastionRooms on a.BastionRoomId equals r.Id
                orderby a.StartDay, a.DateAdded
                select new
                {
                    a.Id, a.SegmentId, a.CharacterId, characterName = c.Name, ownerUserId = c.UserId,
                    a.BastionRoomId, roomName = r.Name, a.ActionKind, a.OrderType, a.Title,
                    a.TurnsCost, a.LongRestsCost, a.StartDay, a.DurationDays, a.Status, a.ResultSummary,
                }).ToListAsync();

            var ids = acts.Select(a => a.Id).ToList();
            var hires = await (
                from ah in _db.BastionActivityHirelings.AsNoTracking()
                where ids.Contains(ah.ActivityId)
                join h in _db.BastionHirelings on ah.BastionHirelingId equals h.Id
                select new { ah.ActivityId, id = h.Id, name = h.Name }).ToListAsync();
            var hByAct = hires.GroupBy(h => h.ActivityId).ToDictionary(g => g.Key, g => g.ToList());

            var bySeg = acts.GroupBy(a => a.SegmentId).ToDictionary(g => g.Key, g => g.ToList());

            var result = segs.Where(s => bySeg.ContainsKey(s.Id)).Select(s => new
            {
                segmentId = s.Id,
                title = s.Title,
                status = s.Status,
                dateIssued = s.DateIssued,
                activities = bySeg[s.Id].Select(a => new
                {
                    id = a.Id, characterId = a.CharacterId, characterName = a.characterName, ownerUserId = a.ownerUserId,
                    bastionRoomId = a.BastionRoomId, roomName = a.roomName, actionKind = a.ActionKind, orderType = a.OrderType,
                    title = a.Title, turnsCost = a.TurnsCost, longRestsCost = a.LongRestsCost, startDay = a.StartDay,
                    durationDays = a.DurationDays, status = a.Status, resultSummary = a.ResultSummary,
                    hirelings = hByAct.TryGetValue(a.Id, out var hl) ? hl.Select(h => new { h.id, h.name }).ToList<object>() : new List<object>(),
                }).ToList<object>()
            }).ToList();

            return await Json(req, HttpStatusCode.OK, new { segments = result });
        }

        // ============================ CREATE ============================
        // POST /api/turn-segments/{segmentId}/activities
        [Function("Activities_Create")]
        public async Task<HttpResponseData> Create(
            [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "turn-segments/{segmentId:guid}/activities")] HttpRequestData req,
            Guid segmentId)
        {
            var userId = Authenticate(req);
            if (userId == null) return req.CreateResponse(HttpStatusCode.Unauthorized);

            var segment = await _db.BastionTurnSegments.AsNoTracking().FirstOrDefaultAsync(s => s.Id == segmentId);
            if (segment == null) return req.CreateResponse(HttpStatusCode.NotFound);
            if (segment.Status != StatusOpen)
                return await Json(req, HttpStatusCode.Conflict, new { error = "This segment is concluded; spending is closed." });

            var campaignId = await CampaignIdForBastionAsync(segment.BastionId);
            if (campaignId == null) return req.CreateResponse(HttpStatusCode.NotFound);
            var isDm = await IsCampaignDmAsync(userId.Value, campaignId.Value);

            var body = await ReadJson<ActivityRequest>(req);
            if (body?.CharacterId == null || body.BastionRoomId == null)
                return await Json(req, HttpStatusCode.BadRequest, new { error = "characterId and bastionRoomId are required." });

            // Character must be part of this segment; the actor must own it (or be the DM).
            var character = await _db.Characters.AsNoTracking().FirstOrDefaultAsync(c => c.Id == body.CharacterId.Value);
            if (character == null) return await Json(req, HttpStatusCode.BadRequest, new { error = "Unknown character." });
            if (!isDm && character.UserId != userId.Value)
                return await Json(req, HttpStatusCode.Forbidden, new { error = "You can only spend time for your own characters." });

            var inSegment = await _db.BastionTurnSegmentCharacters
                .AnyAsync(x => x.SegmentId == segmentId && x.CharacterId == body.CharacterId.Value);
            if (!inSegment) return await Json(req, HttpStatusCode.BadRequest, new { error = "That character wasn't given this segment's time." });

            // Room must belong to the segment's bastion.
            var room = await _db.BastionRooms.AsNoTracking().FirstOrDefaultAsync(r => r.Id == body.BastionRoomId.Value);
            if (room == null || room.BastionId != segment.BastionId)
                return await Json(req, HttpStatusCode.BadRequest, new { error = "That room isn't in this bastion." });

            var kind = (body.ActionKind ?? "order").ToLowerInvariant();
            if (kind != "order" && kind != "special")
                return await Json(req, HttpStatusCode.BadRequest, new { error = "actionKind must be 'order' or 'special'." });

            var turns = Math.Max(0, body.TurnsCost ?? (kind == "order" ? 1 : 0));
            var rests = Math.Max(0, body.LongRestsCost ?? (kind == "special" ? 1 : 0));
            var duration = Math.Max(0, body.DurationDays ?? 0);

            var validation = await ValidateBudgetAndScheduleAsync(segment, room, body.CharacterId.Value, kind, turns, rests, body.StartDay, duration, null);
            if (validation != null) return await Json(req, HttpStatusCode.Conflict, new { error = validation });

            var activity = new BastionActivity
            {
                SegmentId = segmentId,
                CharacterId = body.CharacterId.Value,
                BastionRoomId = body.BastionRoomId.Value,
                ActionKind = kind,
                OrderType = string.IsNullOrWhiteSpace(body.OrderType) ? null : body.OrderType.Trim().ToLowerInvariant(),
                Title = string.IsNullOrWhiteSpace(body.Title) ? null : body.Title.Trim(),
                TurnsCost = turns,
                LongRestsCost = rests,
                StartDay = body.StartDay,
                DurationDays = duration,
                Status = "Planned",
                Notes = string.IsNullOrWhiteSpace(body.Notes) ? null : body.Notes.Trim(),
                CreatedByUserId = userId.Value,
            };
            _db.BastionActivities.Add(activity);

            await AttachHirelingsAsync(activity, room.Id, body.HirelingIds);
            AddLog(segmentId, activity.Id, activity.CharacterId, userId.Value, "created",
                $"{character.Name}: {Describe(activity)}");

            await _db.SaveChangesAsync();
            return await Json(req, HttpStatusCode.OK, await ProjectActivityAsync(activity.Id));
        }

        // ============================ UPDATE ============================
        // PUT /api/activities/{activityId}
        [Function("Activities_Update")]
        public async Task<HttpResponseData> Update(
            [HttpTrigger(AuthorizationLevel.Anonymous, "put", Route = "activities/{activityId:guid}")] HttpRequestData req,
            Guid activityId)
        {
            var userId = Authenticate(req);
            if (userId == null) return req.CreateResponse(HttpStatusCode.Unauthorized);

            var activity = await _db.BastionActivities.FirstOrDefaultAsync(a => a.Id == activityId);
            if (activity == null) return req.CreateResponse(HttpStatusCode.NotFound);

            var segment = await _db.BastionTurnSegments.AsNoTracking().FirstOrDefaultAsync(s => s.Id == activity.SegmentId);
            if (segment == null) return req.CreateResponse(HttpStatusCode.NotFound);
            if (segment.Status != StatusOpen)
                return await Json(req, HttpStatusCode.Conflict, new { error = "This segment is concluded; activities are locked." });

            var campaignId = await CampaignIdForBastionAsync(segment.BastionId);
            if (campaignId == null) return req.CreateResponse(HttpStatusCode.NotFound);
            var isDm = await IsCampaignDmAsync(userId.Value, campaignId.Value);
            var character = await _db.Characters.AsNoTracking().FirstOrDefaultAsync(c => c.Id == activity.CharacterId);
            if (!isDm && character?.UserId != userId.Value)
                return await Json(req, HttpStatusCode.Forbidden, new { error = "You can only edit your own character's activities." });

            var body = await ReadJson<ActivityRequest>(req);
            if (body == null) return await Json(req, HttpStatusCode.BadRequest, new { error = "Invalid body." });

            var room = await _db.BastionRooms.AsNoTracking().FirstOrDefaultAsync(r => r.Id == activity.BastionRoomId);
            if (room == null) return req.CreateResponse(HttpStatusCode.NotFound);

            var kind = string.IsNullOrWhiteSpace(body.ActionKind) ? activity.ActionKind : body.ActionKind.ToLowerInvariant();
            var turns = Math.Max(0, body.TurnsCost ?? activity.TurnsCost);
            var rests = Math.Max(0, body.LongRestsCost ?? activity.LongRestsCost);
            var startDay = body.StartDay ?? activity.StartDay;
            var duration = Math.Max(0, body.DurationDays ?? activity.DurationDays);

            // Only re-validate budget/exclusivity when it's still an active (non-cancelled) plan.
            var newStatus = string.IsNullOrWhiteSpace(body.Status) ? activity.Status : body.Status;
            if (newStatus != StatusCancelled)
            {
                var validation = await ValidateBudgetAndScheduleAsync(segment, room, activity.CharacterId, kind, turns, rests, startDay, duration, activity.Id);
                if (validation != null) return await Json(req, HttpStatusCode.Conflict, new { error = validation });
            }

            activity.ActionKind = kind;
            if (body.OrderType != null) activity.OrderType = string.IsNullOrWhiteSpace(body.OrderType) ? null : body.OrderType.Trim().ToLowerInvariant();
            if (body.Title != null) activity.Title = string.IsNullOrWhiteSpace(body.Title) ? null : body.Title.Trim();
            activity.TurnsCost = turns;
            activity.LongRestsCost = rests;
            activity.StartDay = startDay;
            activity.DurationDays = duration;
            if (body.Notes != null) activity.Notes = string.IsNullOrWhiteSpace(body.Notes) ? null : body.Notes.Trim();
            if (body.Status != null && (body.Status == "Planned" || body.Status == "Completed" || body.Status == StatusCancelled))
                activity.Status = body.Status;
            if (body.ResultSummary != null) activity.ResultSummary = string.IsNullOrWhiteSpace(body.ResultSummary) ? null : body.ResultSummary.Trim();
            activity.DateUpdated = DateTime.UtcNow;

            if (body.HirelingIds != null)
            {
                var existing = await _db.BastionActivityHirelings.Where(x => x.ActivityId == activityId).ToListAsync();
                _db.BastionActivityHirelings.RemoveRange(existing);
                await AttachHirelingsAsync(activity, room.Id, body.HirelingIds);
            }

            AddLog(activity.SegmentId, activity.Id, activity.CharacterId, userId.Value, "edited",
                $"{character?.Name}: {Describe(activity)}");

            await _db.SaveChangesAsync();
            return await Json(req, HttpStatusCode.OK, await ProjectActivityAsync(activity.Id));
        }

        // ============================ DELETE ============================
        // DELETE /api/activities/{activityId}
        [Function("Activities_Delete")]
        public async Task<HttpResponseData> Delete(
            [HttpTrigger(AuthorizationLevel.Anonymous, "delete", Route = "activities/{activityId:guid}")] HttpRequestData req,
            Guid activityId)
        {
            var userId = Authenticate(req);
            if (userId == null) return req.CreateResponse(HttpStatusCode.Unauthorized);

            var activity = await _db.BastionActivities.FirstOrDefaultAsync(a => a.Id == activityId);
            if (activity == null) return req.CreateResponse(HttpStatusCode.NotFound);

            var segment = await _db.BastionTurnSegments.AsNoTracking().FirstOrDefaultAsync(s => s.Id == activity.SegmentId);
            if (segment == null) return req.CreateResponse(HttpStatusCode.NotFound);
            if (segment.Status != StatusOpen)
                return await Json(req, HttpStatusCode.Conflict, new { error = "This segment is concluded; activities are locked." });

            var campaignId = await CampaignIdForBastionAsync(segment.BastionId);
            if (campaignId == null) return req.CreateResponse(HttpStatusCode.NotFound);
            var isDm = await IsCampaignDmAsync(userId.Value, campaignId.Value);
            var character = await _db.Characters.AsNoTracking().FirstOrDefaultAsync(c => c.Id == activity.CharacterId);
            if (!isDm && character?.UserId != userId.Value)
                return await Json(req, HttpStatusCode.Forbidden, new { error = "You can only remove your own character's activities." });

            AddLog(activity.SegmentId, activity.Id, activity.CharacterId, userId.Value, "cancelled",
                $"{character?.Name}: {Describe(activity)}");
            _db.BastionActivities.Remove(activity); // cascade drops BastionActivityHirelings
            await _db.SaveChangesAsync();
            return await Json(req, HttpStatusCode.OK, new { deleted = true });
        }

        // ---------- validation ----------
        // Returns an error string, or null if OK.
        private async Task<string?> ValidateBudgetAndScheduleAsync(
            BastionTurnSegment segment, BastionRoom room, Guid characterId,
            string kind, int turns, int rests, int? startDay, int duration, Guid? excludeActivityId)
        {
            // Budget: sum this character's other (non-cancelled) activities in the segment.
            var others = await _db.BastionActivities.AsNoTracking()
                .Where(a => a.SegmentId == segment.Id && a.CharacterId == characterId && a.Status != StatusCancelled
                            && (excludeActivityId == null || a.Id != excludeActivityId))
                .Select(a => new { a.TurnsCost, a.LongRestsCost })
                .ToListAsync();

            var spentTurns = others.Sum(o => o.TurnsCost);
            var spentRests = others.Sum(o => o.LongRestsCost);

            if (spentTurns + turns > segment.TurnsGranted)
                return $"Not enough turns — {segment.TurnsGranted - spentTurns} of {segment.TurnsGranted} left.";

            var restBudget = segment.DaysGranted * segment.LongRestsPerDay;
            if (spentRests + rests > restBudget)
                return $"Not enough long rests — {restBudget - spentRests} of {restBudget} left.";

            // Scheduling window.
            if (startDay.HasValue)
            {
                if (startDay.Value < 1) return "Start day must be 1 or greater.";
                var endDay = duration > 0 ? startDay.Value + duration - 1 : startDay.Value;
                if (segment.DaysGranted > 0 && endDay > segment.DaysGranted)
                    return $"That runs past day {segment.DaysGranted} (the last day of this segment).";

                // Facility order-slot exclusivity (only meaningful for scheduled orders).
                if (kind == "order")
                {
                    var max = room.MaxConcurrentActivities ?? 1;
                    var roomOrders = await _db.BastionActivities.AsNoTracking()
                        .Where(a => a.SegmentId == segment.Id && a.BastionRoomId == room.Id
                                    && a.ActionKind == "order" && a.Status != StatusCancelled
                                    && a.StartDay != null
                                    && (excludeActivityId == null || a.Id != excludeActivityId))
                        .Select(a => new { Start = a.StartDay!.Value, a.DurationDays })
                        .ToListAsync();

                    var overlapping = roomOrders.Count(o =>
                    {
                        var oEnd = o.DurationDays > 0 ? o.Start + o.DurationDays - 1 : o.Start;
                        return o.Start <= endDay && startDay.Value <= oEnd; // ranges intersect
                    });
                    if (overlapping >= max)
                        return $"This facility can run {max} order{(max == 1 ? "" : "s")} at a time and is busy on those days.";
                }
            }

            return null;
        }

        private async Task AttachHirelingsAsync(BastionActivity activity, Guid roomId, List<Guid>? hirelingIds)
        {
            if (hirelingIds == null || hirelingIds.Count == 0) return;
            var valid = await _db.BastionHirelings.AsNoTracking()
                .Where(h => h.BastionRoomId == roomId && hirelingIds.Contains(h.Id))
                .Select(h => h.Id).ToListAsync();
            foreach (var hid in valid.Distinct())
                _db.BastionActivityHirelings.Add(new BastionActivityHireling { Activity = activity, BastionHirelingId = hid });
        }

        private void AddLog(Guid segmentId, Guid? activityId, Guid? characterId, Guid byUserId, string action, string detail)
        {
            _db.BastionActivityLogs.Add(new BastionActivityLog
            {
                SegmentId = segmentId,
                ActivityId = activityId,
                CharacterId = characterId,
                ByUserId = byUserId,
                Action = action,
                Detail = detail,
            });
        }

        private static string Describe(BastionActivity a)
        {
            var what = a.ActionKind == "order" ? (a.OrderType ?? "order") : "special action";
            var title = string.IsNullOrWhiteSpace(a.Title) ? "" : $" “{a.Title}”";
            var when = a.StartDay.HasValue ? $", day {a.StartDay}{(a.DurationDays > 1 ? $"–{a.StartDay + a.DurationDays - 1}" : "")}" : "";
            var cost = a.TurnsCost > 0 ? $"{a.TurnsCost} turn(s)" : $"{a.LongRestsCost} rest(s)";
            return $"{what}{title} ({cost}{when})";
        }

        // ---------- projection ----------
        private async Task<List<object>> LoadActivitiesAsync(Guid segmentId, Guid? onlyId = null)
        {
            var acts = await (
                from a in _db.BastionActivities.AsNoTracking()
                where a.SegmentId == segmentId && (onlyId == null || a.Id == onlyId)
                join c in _db.Characters on a.CharacterId equals c.Id
                join r in _db.BastionRooms on a.BastionRoomId equals r.Id
                orderby a.StartDay, a.DateAdded
                select new
                {
                    a.Id,
                    a.CharacterId,
                    characterName = c.Name,
                    ownerUserId = c.UserId,
                    a.BastionRoomId,
                    roomName = r.Name,
                    a.ActionKind,
                    a.OrderType,
                    a.Title,
                    a.TurnsCost,
                    a.LongRestsCost,
                    a.StartDay,
                    a.DurationDays,
                    a.Status,
                    a.Notes,
                    a.ResultSummary,
                    a.CreatedByUserId,
                }).ToListAsync();

            var ids = acts.Select(a => a.Id).ToList();
            var hires = await (
                from ah in _db.BastionActivityHirelings.AsNoTracking()
                where ids.Contains(ah.ActivityId)
                join h in _db.BastionHirelings on ah.BastionHirelingId equals h.Id
                select new { ah.ActivityId, id = h.Id, name = h.Name }).ToListAsync();
            var byAct = hires.GroupBy(h => h.ActivityId).ToDictionary(g => g.Key, g => g.ToList());

            // Explicit camelCase — the Functions host serializes member names as-is.
            return acts.Select(a => (object)new
            {
                id = a.Id,
                characterId = a.CharacterId,
                characterName = a.characterName,
                ownerUserId = a.ownerUserId,
                bastionRoomId = a.BastionRoomId,
                roomName = a.roomName,
                actionKind = a.ActionKind,
                orderType = a.OrderType,
                title = a.Title,
                turnsCost = a.TurnsCost,
                longRestsCost = a.LongRestsCost,
                startDay = a.StartDay,
                durationDays = a.DurationDays,
                status = a.Status,
                notes = a.Notes,
                resultSummary = a.ResultSummary,
                createdByUserId = a.CreatedByUserId,
                hirelings = byAct.TryGetValue(a.Id, out var hl)
                    ? hl.Select(h => new { h.id, h.name }).ToList<object>() : new List<object>(),
            }).ToList();
        }

        private async Task<object> ProjectActivityAsync(Guid activityId)
        {
            var segmentId = await _db.BastionActivities.Where(a => a.Id == activityId).Select(a => a.SegmentId).FirstAsync();
            var list = await LoadActivitiesAsync(segmentId, activityId);
            return list.FirstOrDefault() ?? new { };
        }

        // ---------- lookups / auth ----------
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
