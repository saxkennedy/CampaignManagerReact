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
    /// Bastion builder API (Phase 1: multi-floor layout + access).
    /// A campaign "DM" — a member whose campaign persona holds <see cref="DmPermission"/> —
    /// has implicit Write on every bastion in that campaign. Other members get access only
    /// through an explicit <c>UserBastion</c> row (Read / Use / Write).
    /// </summary>
    public class BastionFunctions
    {
        // A campaign persona holding this permission is treated as a bastion "DM" (implicit Write).
        // The creator persona is seeded with every permission, so this reliably identifies the GM.
        private const string DmPermission = "CanManagePersonas";
        private const string CreateBastionPermission = "CreateBastion";

        // Read < Use < Manage < Owner. Owner = the creator (or a Hierarchy-0 campaign persona,
        // who is implicit Owner of every bastion). Only Owner deletes / grants Manage.
        private const byte AccessNone = 0, AccessRead = 1, AccessUse = 2, AccessManage = 3, AccessOwner = 4;

        private readonly CampaignManagerContext _db;
        private readonly ILogger<BastionFunctions> _log;

        public BastionFunctions(CampaignManagerContext db, ILogger<BastionFunctions> log)
        {
            _db = db;
            _log = log;
        }

        private static readonly JsonSerializerOptions JsonOpts = new() { PropertyNameCaseInsensitive = true };

        // ---------- request DTOs ----------
        private sealed class CreateBastionRequest
        {
            public string? Name { get; set; }
            public int? MaxWidth { get; set; }
            public int? MaxHeight { get; set; }
        }

        private sealed class SaveBastionRequest
        {
            public string? Name { get; set; }
            public int? MaxWidth { get; set; }
            public int? MaxHeight { get; set; }
            public List<FloorDto>? Floors { get; set; }   // null = leave floors unchanged
            public List<RoomDto>? Rooms { get; set; }      // null = leave rooms unchanged
            public string? SettingsJson { get; set; } // null = leave view settings unchanged
        }

        private sealed class FloorDto
        {
            public int Level { get; set; }
            public string? Name { get; set; }
        }

        private sealed class RoomDto
        {
            public Guid? Id { get; set; }               // present for existing rooms; omitted for new ones
            public string? ClientKey { get; set; }      // client's temp key; echoed back so it can map new rooms → server Ids
            public string? Kind { get; set; }           // special | basic | hallway | door | entry | stairs
            public Guid? BastionFacilityId { get; set; }
            public string? Name { get; set; }
            public string? SpaceSize { get; set; }
            public int FloorLevel { get; set; }
            public int OriginX { get; set; }
            public int OriginY { get; set; }
            public string? GeometryJson { get; set; }   // JSON string; the client owns its shape
            public string? Color { get; set; }
            public int? MaxConcurrentActivities { get; set; }
        }

        private static readonly HashSet<string> ValidKinds =
            new(StringComparer.OrdinalIgnoreCase) { "special", "basic", "hallway", "door", "entry", "stairs" };

        // ============================ LIST ============================
        // GET /api/campaigns/{campaignId}/bastions
        [Function("Bastions_List")]
        public async Task<HttpResponseData> List(
            [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "campaigns/{campaignId:guid}/bastions")] HttpRequestData req,
            Guid campaignId)
        {
            var userId = Authenticate(req);
            if (userId == null) return req.CreateResponse(HttpStatusCode.Unauthorized);

            var isOwner = await IsCampaignOwnerAsync(userId.Value, campaignId);
            var canCreate = isOwner || await HasCreateBastionAsync(userId.Value, campaignId);
            var bastions = _db.CampaignBastions.AsNoTracking().Where(b => b.CampaignId == campaignId);

            if (isOwner)
            {
                // Hierarchy-0 campaign owner: implicit Owner of every bastion in the campaign.
                var rows = await bastions.OrderBy(b => b.Name).Select(b => new
                {
                    id = b.Id,
                    name = b.Name,
                    maxWidth = b.MaxWidth,
                    maxHeight = b.MaxHeight,
                    isActive = b.IsActive,
                    roomCount = b.BastionRooms.Count,
                    activeSegmentCount = b.BastionTurnSegments.Count(s => s.Status == "Open"),
                    accessLevel = "Owner"
                }).ToListAsync();
                return await Json(req, HttpStatusCode.OK, new { canCreate, bastions = rows });
            }

            var mine = await (
                from b in bastions
                join ub in _db.UserBastions on b.Id equals ub.BastionId
                where ub.UserId == userId.Value
                orderby b.Name
                select new
                {
                    id = b.Id,
                    name = b.Name,
                    maxWidth = b.MaxWidth,
                    maxHeight = b.MaxHeight,
                    isActive = b.IsActive,
                    roomCount = b.BastionRooms.Count,
                    activeSegmentCount = b.BastionTurnSegments.Count(s => s.Status == "Open"),
                    accessLevel = ub.BastionAccessLevel.Name
                }).ToListAsync();
            return await Json(req, HttpStatusCode.OK, new { canCreate, bastions = mine });
        }

        // ============================ CREATE ============================
        // POST /api/campaigns/{campaignId}/bastions   (DM only)
        [Function("Bastions_Create")]
        public async Task<HttpResponseData> Create(
            [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "campaigns/{campaignId:guid}/bastions")] HttpRequestData req,
            Guid campaignId)
        {
            var userId = Authenticate(req);
            if (userId == null) return req.CreateResponse(HttpStatusCode.Unauthorized);

            if (!await IsCampaignOwnerAsync(userId.Value, campaignId) && !await HasCreateBastionAsync(userId.Value, campaignId))
                return await Json(req, HttpStatusCode.Forbidden, new { error = "You need the CreateBastion permission to create a bastion." });

            var body = await ReadJson<CreateBastionRequest>(req);
            var name = body?.Name?.Trim();
            if (string.IsNullOrEmpty(name))
                return await Json(req, HttpStatusCode.BadRequest, new { error = "Name is required." });

            var bastion = new CampaignBastion
            {
                CampaignId = campaignId,
                Name = name,
                MaxWidth = Clamp(body!.MaxWidth ?? 200, 1, 200),
                MaxHeight = Clamp(body.MaxHeight ?? 200, 1, 200),
                CurrentTurn = 0,
                IsActive = true,
                CreatedByUserId = userId.Value,
                // Id + DateAdded from DB defaults (newid() / sysutcdatetime()).
            };
            _db.CampaignBastions.Add(bastion);

            // Every bastion starts with a ground floor.
            _db.BastionFloors.Add(new BastionFloor { Bastion = bastion, Level = 0, Name = "Ground Floor" });

            // The creator becomes the bastion's Owner.
            _db.UserBastions.Add(new UserBastion
            {
                Bastion = bastion,
                UserId = userId.Value,
                BastionAccessLevelId = AccessOwner,
            });

            await _db.SaveChangesAsync();

            return await Json(req, HttpStatusCode.OK, new
            {
                id = bastion.Id,
                name = bastion.Name,
                maxWidth = bastion.MaxWidth,
                maxHeight = bastion.MaxHeight,
                isActive = bastion.IsActive,
                accessLevel = "Owner"
            });
        }

        // ============================ GET (floors + rooms) ============================
        // GET /api/bastions/{bastionId}
        [Function("Bastions_Get")]
        public async Task<HttpResponseData> Get(
            [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "bastions/{bastionId:guid}")] HttpRequestData req,
            Guid bastionId)
        {
            var userId = Authenticate(req);
            if (userId == null) return req.CreateResponse(HttpStatusCode.Unauthorized);

            var bastion = await _db.CampaignBastions.AsNoTracking().FirstOrDefaultAsync(b => b.Id == bastionId);
            if (bastion == null) return req.CreateResponse(HttpStatusCode.NotFound);

            var access = await EffectiveAccessAsync(userId.Value, bastion);
            if (access < AccessRead)
                return await Json(req, HttpStatusCode.Forbidden, new { error = "You don't have access to this bastion." });

            var floors = await LoadFloorsAsync(bastionId);
            var rooms = await LoadRoomsAsync(bastionId);

            return await Json(req, HttpStatusCode.OK, new
            {
                id = bastion.Id,
                campaignId = bastion.CampaignId,
                name = bastion.Name,
                maxWidth = bastion.MaxWidth,
                maxHeight = bastion.MaxHeight,
                currentTurn = bastion.CurrentTurn,
                settingsJson = bastion.SettingsJson,
                isActive = bastion.IsActive,
                accessLevel = LevelName(access),
                floors,
                rooms
            });
        }

        // ============================ SAVE (floors + layout + meta) ============================
        // PUT /api/bastions/{bastionId}   (Write access)
        [Function("Bastions_Save")]
        public async Task<HttpResponseData> Save(
            [HttpTrigger(AuthorizationLevel.Anonymous, "put", Route = "bastions/{bastionId:guid}")] HttpRequestData req,
            Guid bastionId)
        {
            var userId = Authenticate(req);
            if (userId == null) return req.CreateResponse(HttpStatusCode.Unauthorized);

            var bastion = await _db.CampaignBastions.FirstOrDefaultAsync(b => b.Id == bastionId);
            if (bastion == null) return req.CreateResponse(HttpStatusCode.NotFound);

            if (await EffectiveAccessAsync(userId.Value, bastion) < AccessManage)
                return await Json(req, HttpStatusCode.Forbidden, new { error = "You need Manage access to edit this bastion." });

            var body = await ReadJson<SaveBastionRequest>(req);
            if (body == null) return await Json(req, HttpStatusCode.BadRequest, new { error = "Invalid body." });

            if (!string.IsNullOrWhiteSpace(body.Name)) bastion.Name = body.Name.Trim();
            if (body.MaxWidth.HasValue) bastion.MaxWidth = Clamp(body.MaxWidth.Value, 1, 200);
            if (body.MaxHeight.HasValue) bastion.MaxHeight = Clamp(body.MaxHeight.Value, 1, 200);
            if (body.SettingsJson != null)
                bastion.SettingsJson = string.IsNullOrWhiteSpace(body.SettingsJson) ? null : body.SettingsJson;

            // ---- floors (upsert by Level; only when a non-empty set is supplied) ----
            if (body.Floors is { Count: > 0 })
            {
                var existingFloors = await _db.BastionFloors.Where(f => f.BastionId == bastionId).ToListAsync();
                var floorByLevel = existingFloors.ToDictionary(f => f.Level);
                var keepLevels = new HashSet<int>();

                foreach (var fd in body.Floors)
                {
                    keepLevels.Add(fd.Level);
                    if (floorByLevel.TryGetValue(fd.Level, out var ef))
                    {
                        if (!string.IsNullOrWhiteSpace(fd.Name)) ef.Name = fd.Name.Trim();
                    }
                    else
                    {
                        _db.BastionFloors.Add(new BastionFloor
                        {
                            Bastion = bastion,
                            Level = fd.Level,
                            Name = string.IsNullOrWhiteSpace(fd.Name) ? $"Floor {fd.Level}" : fd.Name.Trim()
                        });
                    }
                }
                foreach (var ef in existingFloors)
                    if (!keepLevels.Contains(ef.Level))
                        _db.BastionFloors.Remove(ef);
            }

            // ---- rooms (upsert by Id; only when a list is supplied) ----
            var keyPairs = new List<(string clientKey, BastionRoom entity)>();
            if (body.Rooms != null)
            {
                foreach (var r in body.Rooms)
                    if (r.Kind == null || !ValidKinds.Contains(r.Kind))
                        return await Json(req, HttpStatusCode.BadRequest, new { error = $"Invalid room kind '{r.Kind}'." });

                var existing = await _db.BastionRooms.Where(r => r.BastionId == bastionId).ToListAsync();
                var existingById = existing.ToDictionary(r => r.Id);
                var keep = new HashSet<Guid>();

                foreach (var r in body.Rooms)
                {
                    BastionRoom entity;
                    if (r.Id.HasValue && existingById.TryGetValue(r.Id.Value, out var found))
                    {
                        entity = found;              // update in place (stable Id)
                        keep.Add(entity.Id);
                    }
                    else
                    {
                        entity = new BastionRoom { Bastion = bastion };  // new; server assigns Id
                        _db.BastionRooms.Add(entity);
                    }
                    if (!string.IsNullOrEmpty(r.ClientKey)) keyPairs.Add((r.ClientKey!, entity));

                    entity.Kind = r.Kind!.ToLowerInvariant();
                    entity.BastionFacilityId = r.BastionFacilityId;
                    entity.Name = r.Name;
                    entity.SpaceSize = r.SpaceSize;
                    entity.FloorLevel = r.FloorLevel;
                    entity.OriginX = r.OriginX;
                    entity.OriginY = r.OriginY;
                    entity.GeometryJson = r.GeometryJson;
                    entity.Color = r.Color;
                    entity.MaxConcurrentActivities = r.MaxConcurrentActivities;
                }

                var removed = existing.Where(ex => !keep.Contains(ex.Id)).ToList();
                if (removed.Count > 0)
                {
                    // Activities reference rooms via NO ACTION FK, so clear them (their hireling
                    // links cascade) before removing the rooms; hirelings cascade with the room.
                    var removedIds = removed.Select(r => r.Id).ToList();
                    var acts = await _db.BastionActivities.Where(a => removedIds.Contains(a.BastionRoomId)).ToListAsync();
                    if (acts.Count > 0) _db.BastionActivities.RemoveRange(acts);
                    // Hirelings are campaign-scoped (NO ACTION FK) — return a removed room's
                    // hirelings to the campaign pool instead of deleting them.
                    var orphaned = await _db.BastionHirelings.Where(h => h.BastionRoomId != null && removedIds.Contains(h.BastionRoomId.Value)).ToListAsync();
                    foreach (var h in orphaned) h.BastionRoomId = null;
                    _db.BastionRooms.RemoveRange(removed);
                }
            }

            await _db.SaveChangesAsync();

            // Map each client temp key to its server-assigned room Id so the client can flush
            // work it staged against not-yet-saved rooms (e.g. queued hirelings).
            var roomIdMap = keyPairs.Select(p => new { clientKey = p.clientKey, id = p.entity.Id }).ToList();

            // Return the saved state so the client can adopt server-assigned Ids for new rooms.
            return await Json(req, HttpStatusCode.OK, new
            {
                id = bastion.Id,
                name = bastion.Name,
                maxWidth = bastion.MaxWidth,
                maxHeight = bastion.MaxHeight,
                settingsJson = bastion.SettingsJson,
                floors = await LoadFloorsAsync(bastionId),
                rooms = await LoadRoomsAsync(bastionId),
                roomIdMap
            });
        }

        // ============================ DELETE ============================
        // DELETE /api/bastions/{bastionId}   (Write access; cascade drops floors, rooms, access rows)
        [Function("Bastions_Delete")]
        public async Task<HttpResponseData> Delete(
            [HttpTrigger(AuthorizationLevel.Anonymous, "delete", Route = "bastions/{bastionId:guid}")] HttpRequestData req,
            Guid bastionId)
        {
            var userId = Authenticate(req);
            if (userId == null) return req.CreateResponse(HttpStatusCode.Unauthorized);

            var bastion = await _db.CampaignBastions.FirstOrDefaultAsync(b => b.Id == bastionId);
            if (bastion == null) return req.CreateResponse(HttpStatusCode.NotFound);

            if (await EffectiveAccessAsync(userId.Value, bastion) < AccessOwner)
                return await Json(req, HttpStatusCode.Forbidden, new { error = "Only the bastion's Owner can delete it." });

            // Rooms cascade with the bastion, but activities and hirelings reach them over
            // NO ACTION FKs, so the cascade is rejected while any of those rows still point at
            // a room. Clear them first — the same cleanup the layout save does when it drops
            // rooms — and land it in its own round trip so it can't be reordered after the
            // cascade. A transaction keeps a failed delete from stranding the bastion with its
            // activities already gone.
            var roomIds = await _db.BastionRooms.Where(r => r.BastionId == bastionId).Select(r => r.Id).ToListAsync();

            await using var tx = await _db.Database.BeginTransactionAsync();

            if (roomIds.Count > 0)
            {
                var acts = await _db.BastionActivities.Where(a => roomIds.Contains(a.BastionRoomId)).ToListAsync();
                if (acts.Count > 0) _db.BastionActivities.RemoveRange(acts);   // their hireling links cascade

                // Hirelings are campaign-scoped — return them to the campaign pool, don't delete them.
                var assigned = await _db.BastionHirelings
                    .Where(h => h.BastionRoomId != null && roomIds.Contains(h.BastionRoomId.Value))
                    .ToListAsync();
                foreach (var h in assigned) h.BastionRoomId = null;

                await _db.SaveChangesAsync();
            }

            _db.CampaignBastions.Remove(bastion);
            await _db.SaveChangesAsync();
            await tx.CommitAsync();

            return await Json(req, HttpStatusCode.OK, new { deleted = true });
        }

        // ============================ MEMBERS ============================
        private sealed class MemberUpsertRequest { public Guid? UserId { get; set; } public string? AccessLevel { get; set; } }
        private sealed class MemberCharactersRequest { public List<Guid>? CharacterIds { get; set; } }

        // GET /api/bastions/{bastionId}/members   (Manage+)
        [Function("Bastions_MembersList")]
        public async Task<HttpResponseData> MembersList(
            [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "bastions/{bastionId:guid}/members")] HttpRequestData req,
            Guid bastionId)
        {
            var userId = Authenticate(req);
            if (userId == null) return req.CreateResponse(HttpStatusCode.Unauthorized);
            var bastion = await _db.CampaignBastions.FirstOrDefaultAsync(b => b.Id == bastionId);
            if (bastion == null) return req.CreateResponse(HttpStatusCode.NotFound);
            var access = await EffectiveAccessAsync(userId.Value, bastion);
            if (access < AccessManage) return await Json(req, HttpStatusCode.Forbidden, new { error = "You need Manage access." });

            var members = await (
                from ub in _db.UserBastions.AsNoTracking()
                where ub.BastionId == bastionId
                join u in _db.Users on ub.UserId equals u.Id
                orderby ub.BastionAccessLevelId descending, u.FirstName
                select new { userId = u.Id, firstName = u.FirstName, lastName = u.LastName, email = u.Email, accessLevel = ub.BastionAccessLevel.Name }
            ).ToListAsync();

            var chars = await (
                from bc in _db.BastionCharacters.AsNoTracking()
                where bc.BastionId == bastionId
                join c in _db.Characters on bc.CharacterId equals c.Id
                select new { c.Id, c.Name, c.UserId }
            ).ToListAsync();
            var charsByUser = chars.Where(c => c.UserId != null)
                .GroupBy(c => c.UserId!.Value)
                .ToDictionary(g => g.Key, g => g.Select(c => (object)new { id = c.Id, name = c.Name }).ToList());

            var result = members.Select(m => new
            {
                m.userId, m.firstName, m.lastName, m.email, m.accessLevel,
                characters = charsByUser.TryGetValue(m.userId, out var cs) ? cs : new List<object>()
            });
            return await Json(req, HttpStatusCode.OK, new { canManage = true, canGrantManage = access >= AccessOwner, members = result });
        }

        // POST /api/bastions/{bastionId}/members   (Manage+; granting Manage requires Owner)
        [Function("Bastions_MemberUpsert")]
        public async Task<HttpResponseData> MemberUpsert(
            [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "bastions/{bastionId:guid}/members")] HttpRequestData req,
            Guid bastionId)
        {
            var userId = Authenticate(req);
            if (userId == null) return req.CreateResponse(HttpStatusCode.Unauthorized);
            var bastion = await _db.CampaignBastions.FirstOrDefaultAsync(b => b.Id == bastionId);
            if (bastion == null) return req.CreateResponse(HttpStatusCode.NotFound);
            var access = await EffectiveAccessAsync(userId.Value, bastion);
            if (access < AccessManage) return await Json(req, HttpStatusCode.Forbidden, new { error = "You need Manage access." });

            var body = await ReadJson<MemberUpsertRequest>(req);
            if (body?.UserId == null) return await Json(req, HttpStatusCode.BadRequest, new { error = "userId is required." });
            var levelId = LevelIdFromName(body.AccessLevel);
            if (levelId == 0) return await Json(req, HttpStatusCode.BadRequest, new { error = "accessLevel must be Read, Use, or Manage." });
            if (levelId >= AccessManage && access < AccessOwner)
                return await Json(req, HttpStatusCode.Forbidden, new { error = "Only the Owner can grant Manage." });
            if (!await IsCampaignMemberAsync(body.UserId.Value, bastion.CampaignId))
                return await Json(req, HttpStatusCode.BadRequest, new { error = "That player isn't a member of this campaign." });

            var ub = await _db.UserBastions.FirstOrDefaultAsync(x => x.BastionId == bastionId && x.UserId == body.UserId.Value);
            if (ub == null)
            {
                _db.UserBastions.Add(new UserBastion { BastionId = bastionId, UserId = body.UserId.Value, BastionAccessLevelId = levelId });
            }
            else
            {
                if (ub.BastionAccessLevelId >= AccessOwner && access < AccessOwner)
                    return await Json(req, HttpStatusCode.Forbidden, new { error = "Only an Owner can change an Owner's access." });
                ub.BastionAccessLevelId = levelId;
            }
            await _db.SaveChangesAsync();
            return await Json(req, HttpStatusCode.OK, new { ok = true });
        }

        // DELETE /api/bastions/{bastionId}/members/{memberUserId}   (Manage+; can't remove an Owner unless Owner)
        [Function("Bastions_MemberRemove")]
        public async Task<HttpResponseData> MemberRemove(
            [HttpTrigger(AuthorizationLevel.Anonymous, "delete", Route = "bastions/{bastionId:guid}/members/{memberUserId:guid}")] HttpRequestData req,
            Guid bastionId, Guid memberUserId)
        {
            var userId = Authenticate(req);
            if (userId == null) return req.CreateResponse(HttpStatusCode.Unauthorized);
            var bastion = await _db.CampaignBastions.FirstOrDefaultAsync(b => b.Id == bastionId);
            if (bastion == null) return req.CreateResponse(HttpStatusCode.NotFound);
            var access = await EffectiveAccessAsync(userId.Value, bastion);
            if (access < AccessManage) return await Json(req, HttpStatusCode.Forbidden, new { error = "You need Manage access." });

            var ub = await _db.UserBastions.FirstOrDefaultAsync(x => x.BastionId == bastionId && x.UserId == memberUserId);
            if (ub == null) return await Json(req, HttpStatusCode.OK, new { removed = true });
            if (ub.BastionAccessLevelId >= AccessOwner && access < AccessOwner)
                return await Json(req, HttpStatusCode.Forbidden, new { error = "Only an Owner can remove an Owner." });

            var theirChars = await (
                from bc in _db.BastionCharacters
                join c in _db.Characters on bc.CharacterId equals c.Id
                where bc.BastionId == bastionId && c.UserId == memberUserId
                select bc).ToListAsync();
            if (theirChars.Count > 0) _db.BastionCharacters.RemoveRange(theirChars);
            _db.UserBastions.Remove(ub);
            await _db.SaveChangesAsync();
            return await Json(req, HttpStatusCode.OK, new { removed = true });
        }

        // PUT /api/bastions/{bastionId}/members/{memberUserId}/characters   (Manage+)
        [Function("Bastions_MemberCharacters")]
        public async Task<HttpResponseData> MemberCharacters(
            [HttpTrigger(AuthorizationLevel.Anonymous, "put", Route = "bastions/{bastionId:guid}/members/{memberUserId:guid}/characters")] HttpRequestData req,
            Guid bastionId, Guid memberUserId)
        {
            var userId = Authenticate(req);
            if (userId == null) return req.CreateResponse(HttpStatusCode.Unauthorized);
            var bastion = await _db.CampaignBastions.FirstOrDefaultAsync(b => b.Id == bastionId);
            if (bastion == null) return req.CreateResponse(HttpStatusCode.NotFound);
            if (await EffectiveAccessAsync(userId.Value, bastion) < AccessManage)
                return await Json(req, HttpStatusCode.Forbidden, new { error = "You need Manage access." });

            var body = await ReadJson<MemberCharactersRequest>(req);
            var want = body?.CharacterIds ?? new List<Guid>();
            var valid = await _db.Characters.AsNoTracking()
                .Where(c => c.UserId == memberUserId && c.CampaignId == bastion.CampaignId && want.Contains(c.Id))
                .Select(c => c.Id).ToListAsync();
            var validSet = valid.ToHashSet();

            var existing = await (
                from bc in _db.BastionCharacters
                join c in _db.Characters on bc.CharacterId equals c.Id
                where bc.BastionId == bastionId && c.UserId == memberUserId
                select bc).ToListAsync();
            foreach (var bc in existing) if (!validSet.Contains(bc.CharacterId)) _db.BastionCharacters.Remove(bc);
            var have = existing.Select(bc => bc.CharacterId).ToHashSet();
            foreach (var cid in valid) if (!have.Contains(cid)) _db.BastionCharacters.Add(new BastionCharacter { BastionId = bastionId, CharacterId = cid });

            await _db.SaveChangesAsync();
            return await Json(req, HttpStatusCode.OK, new { ok = true });
        }

        // GET /api/bastions/{bastionId}/characters   (Read+; the bastion's assigned characters)
        [Function("Bastions_Characters")]
        public async Task<HttpResponseData> BastionCharactersList(
            [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "bastions/{bastionId:guid}/characters")] HttpRequestData req,
            Guid bastionId)
        {
            var userId = Authenticate(req);
            if (userId == null) return req.CreateResponse(HttpStatusCode.Unauthorized);
            var bastion = await _db.CampaignBastions.FirstOrDefaultAsync(b => b.Id == bastionId);
            if (bastion == null) return req.CreateResponse(HttpStatusCode.NotFound);
            if (await EffectiveAccessAsync(userId.Value, bastion) < AccessRead
                && !await HasPermissionAsync(userId.Value, bastion.CampaignId, DmPermission))
                return await Json(req, HttpStatusCode.Forbidden, new { error = "You don't have access to this bastion." });

            var chars = await (
                from bc in _db.BastionCharacters.AsNoTracking()
                where bc.BastionId == bastionId
                join c in _db.Characters on bc.CharacterId equals c.Id
                join u in _db.Users on c.UserId equals u.Id into gu
                from u in gu.DefaultIfEmpty()
                where c.IsActive
                orderby c.Name
                select new
                {
                    characterId = c.Id,
                    name = c.Name,
                    ownerUserId = c.UserId,
                    ownerFirstName = u != null ? u.FirstName : null,
                    ownerLastName = u != null ? u.LastName : null,
                }).ToListAsync();
            return await Json(req, HttpStatusCode.OK, new { characters = chars });
        }

        private static byte LevelIdFromName(string? name) => (name ?? "").Trim().ToLowerInvariant() switch
        {
            "read" => AccessRead,
            "use" => AccessUse,
            "manage" => AccessManage,
            _ => 0
        };

        private async Task<bool> IsCampaignMemberAsync(Guid userId, Guid campaignId) =>
            await (
                from ucp in _db.UserCampaignPersonas
                join cp in _db.CampaignPersonas on ucp.CampaignPersonaId equals cp.Id
                where ucp.UserId == userId && cp.CampaignId == campaignId
                select ucp.UserId
            ).AnyAsync();

        // ---------- data loaders ----------

        private async Task<object> LoadFloorsAsync(Guid bastionId) =>
            await _db.BastionFloors.AsNoTracking()
                .Where(f => f.BastionId == bastionId)
                .OrderBy(f => f.Level)
                .Select(f => new { level = f.Level, name = f.Name })
                .ToListAsync();

        private async Task<object> LoadRoomsAsync(Guid bastionId) =>
            await _db.BastionRooms.AsNoTracking()
                .Where(r => r.BastionId == bastionId)
                .Select(r => new
                {
                    id = r.Id,
                    kind = r.Kind,
                    bastionFacilityId = r.BastionFacilityId,
                    name = r.Name,
                    spaceSize = r.SpaceSize,
                    floorLevel = r.FloorLevel,
                    originX = r.OriginX,
                    originY = r.OriginY,
                    geometryJson = r.GeometryJson,
                    color = r.Color,
                    maxConcurrentActivities = r.MaxConcurrentActivities
                })
                .ToListAsync();

        // ---------- authorization helpers ----------

        private async Task<byte> EffectiveAccessAsync(Guid userId, CampaignBastion bastion)
        {
            // A Hierarchy-0 campaign persona is implicit Owner of every bastion.
            if (await IsCampaignOwnerAsync(userId, bastion.CampaignId))
                return AccessOwner;

            var ub = await _db.UserBastions.AsNoTracking()
                .FirstOrDefaultAsync(x => x.BastionId == bastion.Id && x.UserId == userId);
            return ub?.BastionAccessLevelId ?? AccessNone;
        }

        // Holds the top/creator persona (Hierarchy 0) in this campaign.
        private async Task<bool> IsCampaignOwnerAsync(Guid userId, Guid campaignId)
        {
            return await (
                from ucp in _db.UserCampaignPersonas
                join cp in _db.CampaignPersonas on ucp.CampaignPersonaId equals cp.Id
                where ucp.UserId == userId && cp.CampaignId == campaignId && cp.Hierarchy == 0
                select cp.Id
            ).AnyAsync();
        }

        // Holds the CreateBastion permission via any persona in this campaign.
        private Task<bool> HasCreateBastionAsync(Guid userId, Guid campaignId) => HasPermissionAsync(userId, campaignId, CreateBastionPermission);

        private async Task<bool> HasPermissionAsync(Guid userId, Guid campaignId, string permission)
        {
            return await (
                from ucp in _db.UserCampaignPersonas
                join cp in _db.CampaignPersonas on ucp.CampaignPersonaId equals cp.Id
                join cpp in _db.CampaignPersonaPermissions on cp.Id equals cpp.CampaignPersonaId
                join p in _db.Permissions on cpp.PermissionId equals p.Id
                where ucp.UserId == userId && cp.CampaignId == campaignId && p.DisplayName == permission
                select p.Id
            ).AnyAsync();
        }

        private static string LevelName(byte level) => level switch
        {
            AccessOwner => "Owner",
            AccessManage => "Manage",
            AccessUse => "Use",
            AccessRead => "Read",
            _ => "None"
        };

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
