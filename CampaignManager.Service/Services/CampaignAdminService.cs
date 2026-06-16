using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using CampaignManager.Services.Authorization;
using CampaignManager.Services.Models;
using CampaignManager.Services.Services.Abstractions;
using Data.Models;
using Microsoft.EntityFrameworkCore;

namespace CampaignManager.Services.Services
{
    public class CampaignAdminService : ICampaignAdminService
    {
        // The creator persona sits at the top of the hierarchy. Exactly one per campaign,
        // always holds every assignable permission, and is only ever held by the creator.
        private const int CreatorHierarchy = 0;

        // Highest non-creator rank; campaigns allow the creator (0) plus ranks 1..MaxRank.
        private const int MaxRank = 10;

        // Members are listed below this count; at or above it the UI shows "10+".
        private const int MemberListCap = 10;

        private readonly CampaignManagerContext CampaignManagerContext;

        public CampaignAdminService(CampaignManagerContext campaignManagerContext)
        {
            CampaignManagerContext = campaignManagerContext;
        }

        public async Task<CreateCampaignResponse> CreateCampaign(Guid creatorUserId, CampaignUpsertRequest request)
        {
            if (request == null) throw new ArgumentNullException(nameof(request));
            if (string.IsNullOrWhiteSpace(request.Name))
                throw new InvalidOperationException("Campaign Name is required.");

            var personas = request.Personas ?? new();
            // Require at least 2 personas (creator + one more).
            if (personas.Count < 2)
                throw new InvalidOperationException("At least two CampaignPersonas are required.");
            if (personas.Count > MaxRank + 1)
                throw new InvalidOperationException($"A maximum of {MaxRank + 1} CampaignPersonas is allowed.");

            // Must have exactly one creator persona (Hierarchy 0).
            var creators = personas.Where(p => p.Hierarchy == CreatorHierarchy).ToList();
            if (creators.Count != 1)
                throw new InvalidOperationException($"Exactly one CampaignPersona must have Hierarchy = {CreatorHierarchy} (the creator).");

            // Enforce unique hierarchy values to avoid ambiguity
            var dupHierarchy = personas
                .GroupBy(p => p.Hierarchy)
                .Where(g => g.Count() > 1)
                .Select(g => g.Key)
                .ToList();
            if (dupHierarchy.Any())
                throw new InvalidOperationException("CampaignPersona Hierarchy values must be unique.");

            // Validate join persona hierarchy exists in list and isn't the creator.
            var joinHierarchy = request.CampaignJoinPersonaHierarchy;
            if (joinHierarchy == CreatorHierarchy)
                throw new InvalidOperationException("The join persona cannot be the creator persona.");
            var joinPersonaSpec = personas.FirstOrDefault(p => p.Hierarchy == joinHierarchy);
            if (joinPersonaSpec == null)
                throw new InvalidOperationException($"Join Persona Hierarchy ({joinHierarchy}) must match one of the personas on the campaign.");

            using var tx = await CampaignManagerContext.Database.BeginTransactionAsync();

            var campaignId = Guid.NewGuid();

            var campaign = new Campaign
            {
                Id = campaignId,
                Name = request.Name.Trim(),
                // keep your current null behavior (OK if DB allows null)
                Description = string.IsNullOrWhiteSpace(request.Description) ? null : request.Description,
                CampaignJoinPassword = string.IsNullOrWhiteSpace(request.CampaignJoinPassword) ? null : request.CampaignJoinPassword,
                // join persona id will be set after persona creation
                CampaignJoinPersonaId = null
            };

            CampaignManagerContext.Campaigns.Add(campaign);

            Guid creatorPersonaId = Guid.Empty;
            Guid joinPersonaId = Guid.Empty;

            // Permission catalog: the creator persona is always seeded with everything assignable
            // so they can't be locked out; other personas get exactly what the creator selected.
            var assignablePermissionIds = await CampaignManagerContext.Permissions
                .Where(p => p.CampaignAssignable)
                .Select(p => p.Id)
                .ToListAsync();
            var assignableSet = assignablePermissionIds.ToHashSet();

            foreach (var p in personas)
            {
                if (string.IsNullOrWhiteSpace(p.DisplayName))
                    throw new InvalidOperationException("CampaignPersona DisplayName is required.");

                var personaId = Guid.NewGuid();

                var persona = new CampaignPersona
                {
                    Id = personaId,
                    CampaignId = campaignId,
                    DisplayName = p.DisplayName.Trim(),
                    Hierarchy = p.Hierarchy
                };

                CampaignManagerContext.CampaignPersonas.Add(persona);

                var grantIds = p.Hierarchy == CreatorHierarchy
                    ? (IEnumerable<Guid>)assignablePermissionIds
                    : (p.PermissionIds ?? new List<Guid>()).Distinct().Where(id => assignableSet.Contains(id));

                foreach (var pid in grantIds)
                {
                    CampaignManagerContext.CampaignPersonaPermissions.Add(new CampaignPersonaPermission
                    {
                        CampaignPersonaId = personaId,
                        PermissionId = pid
                    });
                }

                if (p.Hierarchy == CreatorHierarchy) creatorPersonaId = personaId;
                if (p.Hierarchy == joinHierarchy) joinPersonaId = personaId;
            }

            if (creatorPersonaId == Guid.Empty)
                throw new InvalidOperationException($"Creator persona (Hierarchy {CreatorHierarchy}) could not be resolved.");
            if (joinPersonaId == Guid.Empty)
                throw new InvalidOperationException("Join persona could not be resolved.");

            // ✅ Enforce join persona set (even though DB allows null now)
            campaign.CampaignJoinPersonaId = joinPersonaId;

            // Add creator membership at the creator hierarchy
            CampaignManagerContext.UserCampaignPersonas.Add(new UserCampaignPersona
            {
                UserId = creatorUserId,
                CampaignPersonaId = creatorPersonaId
            });

            await CampaignManagerContext.SaveChangesAsync();
            await tx.CommitAsync();

            return new CreateCampaignResponse
            {
                CampaignId = campaignId,
                CreatorPersonaId = creatorPersonaId,
                JoinPersonaId = joinPersonaId
            };
        }

        // --- existing content CRUD unchanged ---
        public async Task<string> CRUDContent(CRUDContentRequest request)
        {
            if (request.Delete)
            {
                var entry = await CampaignManagerContext.CampaignCategoryContentXrefs
                    .FirstOrDefaultAsync(c => c.Id == request.Id);
                if (entry == null)
                {
                    return "Failed.  Item not found.";
                }
                else
                {
                    var itemId = entry.Id;
                    var children = CampaignManagerContext.CampaignCategoryContentXrefs
                        .Where(c => c.ParentContentId == itemId);
                    CampaignManagerContext.CampaignCategoryContentXrefs.RemoveRange(children);
                    CampaignManagerContext.CampaignCategoryContentXrefs.Remove(entry);
                    await CampaignManagerContext.SaveChangesAsync();
                    return "Successfully Deleted Item";
                }
            }
            if (request.Id != Guid.Empty && request.Id != null) //update case
            {
                var entry = await CampaignManagerContext.CampaignCategoryContentXrefs
                    .FirstOrDefaultAsync(c => c.Id == request.Id);
                if (entry == null)
                {
                    return "Failed.  Item not found.";
                }
                entry.DisplayName = request.DisplayName;
                entry.Description = request.Description ?? null;
                entry.AccessHierarchyLevel = request.AccessHierarchyLevel;
                entry.ContentLink = request.ContentLink ?? null;
                entry.IconLink = request.IconLink ?? null;
                entry.SimpleContent = request.SimpleContent ?? null;
                entry.ContentTypeId = request.ContentTypeId;
                CampaignManagerContext.CampaignCategoryContentXrefs.Update(entry);
                await CampaignManagerContext.SaveChangesAsync();
                return "Successfully Updated Item";
            }
            else
            {
                try
                {
                    CampaignCategoryContentXref entry = new CampaignCategoryContentXref
                    {
                        Id = Guid.NewGuid(),
                        CampaignId = request.CampaignId,
                        ParentContentId = request.ParentContentId ?? null,
                        CreatorId = request.CreatorId,
                        DisplayName = request.DisplayName,
                        Description = request.Description ?? null,
                        AccessHierarchyLevel = request.AccessHierarchyLevel,
                        ContentLink = request.ContentLink ?? null,
                        IconLink = request.IconLink ?? null,
                        SimpleContent = request.SimpleContent ?? null,
                        ContentTypeId = request.ContentTypeId
                    };
                    CampaignManagerContext.CampaignCategoryContentXrefs.Add(entry);
                    CampaignManagerContext.SaveChanges();

                    return "Successfully added item";
                }
                catch (Exception ex)
                {
                    return "Failed.  " + ex.Message;
                }
            }
        }

        // ---------------------------------------------------------------------
        // Tab 2: persona management
        // ---------------------------------------------------------------------

        public async Task<List<PermissionOption>> GetAssignablePermissions()
        {
            return await CampaignManagerContext.Permissions
                .AsNoTracking()
                .Where(p => p.CampaignAssignable)
                .OrderBy(p => p.DisplayName)
                .Select(p => new PermissionOption { Id = p.Id, DisplayName = p.DisplayName })
                .ToListAsync();
        }

        public async Task<PersonaManagementResponse> GetPersonaManagement(Guid actorUserId, Guid campaignId)
        {
            var actor = await GetActorContext(actorUserId, campaignId);
            RequirePermission(actor, PermissionNames.CanManagePersonas);

            var personas = await CampaignManagerContext.CampaignPersonas
                .AsNoTracking()
                .Where(p => p.CampaignId == campaignId)
                .Select(p => new PersonaDetail
                {
                    Id = p.Id,
                    DisplayName = p.DisplayName,
                    Hierarchy = p.Hierarchy,
                    PermissionIds = p.CampaignPersonaPermissions.Select(x => x.PermissionId).ToList(),
                    MemberCount = p.UserCampaignPersonas.Count(),
                    Members = p.UserCampaignPersonas
                        .OrderBy(u => u.User.Email)
                        .Take(MemberListCap)
                        .Select(u => new MemberSummary
                        {
                            UserId = u.UserId,
                            Email = u.User.Email,
                            FirstName = u.User.FirstName,
                            LastName = u.User.LastName
                        })
                        .ToList()
                })
                .OrderBy(p => p.Hierarchy)
                .ToListAsync();

            var assignable = await CampaignManagerContext.Permissions
                .AsNoTracking()
                .Where(p => p.CampaignAssignable)
                .OrderBy(p => p.DisplayName)
                .Select(p => new PermissionOption { Id = p.Id, DisplayName = p.DisplayName })
                .ToListAsync();

            return new PersonaManagementResponse
            {
                Personas = personas,
                AssignablePermissions = assignable,
                ActorLevel = actor.Level,
                ActorPersonaIds = actor.OwnedPersonaIds.ToList()
            };
        }

        public async Task<PersonaDetail> UpsertPersona(Guid actorUserId, Guid campaignId, PersonaUpsertRequest request)
        {
            if (request == null) throw new ArgumentNullException(nameof(request));

            var actor = await GetActorContext(actorUserId, campaignId);
            RequirePermission(actor, PermissionNames.CanManagePersonas);

            if (string.IsNullOrWhiteSpace(request.DisplayName))
                throw new InvalidOperationException("Persona name is required.");
            var name = request.DisplayName.Trim();
            var rank = request.Hierarchy;
            if (rank < CreatorHierarchy || rank > MaxRank)
                throw new InvalidOperationException($"Hierarchy must be between {CreatorHierarchy} and {MaxRank}.");

            var personas = await CampaignManagerContext.CampaignPersonas
                .Where(p => p.CampaignId == campaignId)
                .ToListAsync();

            CampaignPersona target = null;
            if (request.Id.HasValue)
            {
                target = personas.FirstOrDefault(p => p.Id == request.Id.Value)
                    ?? throw new InvalidOperationException("Persona not found.");

                // You may edit your own persona, or any persona strictly below your level.
                var ownsTarget = actor.OwnedPersonaIds.Contains(target.Id);
                if (!ownsTarget && target.Hierarchy <= actor.Level)
                    throw new UnauthorizedAccessException("You can only edit personas below your own level.");

                if (target.Hierarchy == CreatorHierarchy && rank != CreatorHierarchy)
                    throw new InvalidOperationException($"The creator persona must remain at Hierarchy {CreatorHierarchy}.");
                if (target.Hierarchy != CreatorHierarchy && rank == CreatorHierarchy)
                    throw new InvalidOperationException($"Hierarchy {CreatorHierarchy} is reserved for the creator persona.");

                // Moving a persona's rank: the new rank must be below your own level.
                if (rank != target.Hierarchy && rank <= actor.Level)
                    throw new InvalidOperationException("You can only assign ranks below your own level.");
            }
            else
            {
                if (personas.Count >= MaxRank + 1)
                    throw new InvalidOperationException($"A campaign may have at most {MaxRank + 1} personas.");
                if (rank == CreatorHierarchy)
                    throw new InvalidOperationException($"Hierarchy {CreatorHierarchy} is reserved for the creator persona.");
                if (rank <= actor.Level)
                    throw new InvalidOperationException("You can only create personas below your own level.");
            }

            // Ranks are unique per campaign — hard block on collision.
            var clash = personas.FirstOrDefault(p => p.Hierarchy == rank && (target == null || p.Id != target.Id));
            if (clash != null)
                throw new RankConflictException(rank, clash.DisplayName);

            // Only campaign-assignable permissions may be granted.
            var assignableIds = await CampaignManagerContext.Permissions
                .Where(p => p.CampaignAssignable)
                .Select(p => p.Id)
                .ToListAsync();
            var assignableSet = assignableIds.ToHashSet();
            var desired = (request.PermissionIds ?? new List<Guid>()).Distinct().ToList();
            if (desired.Any(pid => !assignableSet.Contains(pid)))
                throw new InvalidOperationException("One or more permissions are invalid or not campaign-assignable.");

            // The creator persona always holds every assignable permission, regardless of input.
            if (rank == CreatorHierarchy)
                desired = assignableIds.ToList();

            using var tx = await CampaignManagerContext.Database.BeginTransactionAsync();

            if (target == null)
            {
                target = new CampaignPersona
                {
                    Id = Guid.NewGuid(),
                    CampaignId = campaignId,
                    DisplayName = name,
                    Hierarchy = rank
                };
                CampaignManagerContext.CampaignPersonas.Add(target);
            }
            else
            {
                target.DisplayName = name;
                target.Hierarchy = rank;
            }

            // Reconcile permission rows to match the desired set.
            var existing = await CampaignManagerContext.CampaignPersonaPermissions
                .Where(x => x.CampaignPersonaId == target.Id)
                .ToListAsync();
            var existingIds = existing.Select(x => x.PermissionId).ToHashSet();

            foreach (var row in existing.Where(x => !desired.Contains(x.PermissionId)))
                CampaignManagerContext.CampaignPersonaPermissions.Remove(row);

            foreach (var pid in desired.Where(d => !existingIds.Contains(d)))
                CampaignManagerContext.CampaignPersonaPermissions.Add(new CampaignPersonaPermission
                {
                    CampaignPersonaId = target.Id,
                    PermissionId = pid
                });

            await CampaignManagerContext.SaveChangesAsync();
            await tx.CommitAsync();

            var memberCount = await CampaignManagerContext.UserCampaignPersonas
                .CountAsync(u => u.CampaignPersonaId == target.Id);
            var members = await CampaignManagerContext.UserCampaignPersonas
                .Where(u => u.CampaignPersonaId == target.Id)
                .OrderBy(u => u.User.Email)
                .Take(MemberListCap)
                .Select(u => new MemberSummary
                {
                    UserId = u.UserId,
                    Email = u.User.Email,
                    FirstName = u.User.FirstName,
                    LastName = u.User.LastName
                })
                .ToListAsync();

            return new PersonaDetail
            {
                Id = target.Id,
                DisplayName = target.DisplayName,
                Hierarchy = target.Hierarchy,
                PermissionIds = desired,
                MemberCount = memberCount,
                Members = members
            };
        }

        public async Task<DeletePersonaResult> DeletePersona(Guid actorUserId, Guid campaignId, Guid personaId)
        {
            var actor = await GetActorContext(actorUserId, campaignId);
            RequirePermission(actor, PermissionNames.CanManagePersonas);

            var persona = await CampaignManagerContext.CampaignPersonas
                .FirstOrDefaultAsync(p => p.Id == personaId && p.CampaignId == campaignId)
                ?? throw new InvalidOperationException("Persona not found.");

            if (persona.Hierarchy == CreatorHierarchy)
                throw new InvalidOperationException($"The creator persona (Hierarchy {CreatorHierarchy}) cannot be deleted.");
            if (persona.Hierarchy <= actor.Level)
                throw new UnauthorizedAccessException("You can only delete personas below your own level.");

            // The campaign's join persona can't be deleted while it's the configured landing spot.
            var campaign = await CampaignManagerContext.Campaigns
                .FirstOrDefaultAsync(c => c.Id == campaignId);
            if (campaign != null && campaign.CampaignJoinPersonaId == personaId)
                throw new InvalidOperationException(
                    "This is the campaign's join persona. Set a different join persona before deleting it.");

            var memberCount = await CampaignManagerContext.UserCampaignPersonas
                .CountAsync(u => u.CampaignPersonaId == personaId);

            if (memberCount > 0)
            {
                var members = await CampaignManagerContext.UserCampaignPersonas
                    .Where(u => u.CampaignPersonaId == personaId)
                    .OrderBy(u => u.User.Email)
                    .Take(MemberListCap)
                    .Select(u => new MemberSummary
                    {
                        UserId = u.UserId,
                        Email = u.User.Email,
                        FirstName = u.User.FirstName,
                        LastName = u.User.LastName
                    })
                    .ToListAsync();

                return new DeletePersonaResult
                {
                    Deleted = false,
                    Error = "This persona still has members assigned. Reassign them before deleting it.",
                    BlockingMembers = members,
                    MemberCount = memberCount
                };
            }

            var perms = CampaignManagerContext.CampaignPersonaPermissions
                .Where(x => x.CampaignPersonaId == personaId);
            CampaignManagerContext.CampaignPersonaPermissions.RemoveRange(perms);
            CampaignManagerContext.CampaignPersonas.Remove(persona);
            await CampaignManagerContext.SaveChangesAsync();

            return new DeletePersonaResult { Deleted = true };
        }

        // ---------------------------------------------------------------------
        // Tab 3: members + reassignment
        // ---------------------------------------------------------------------

        public async Task<CampaignMembersResponse> GetCampaignMembers(Guid actorUserId, Guid campaignId)
        {
            var actor = await GetActorContext(actorUserId, campaignId);
            RequirePermission(actor, PermissionNames.CanReassignUsers);

            // One row per (user, persona) membership in this campaign.
            var members = await CampaignManagerContext.UserCampaignPersonas
                .AsNoTracking()
                .Where(ucp => ucp.CampaignPersona.CampaignId == campaignId)
                .Select(ucp => new CampaignMemberDetail
                {
                    UserId = ucp.UserId,
                    Email = ucp.User.Email,
                    FirstName = ucp.User.FirstName,
                    LastName = ucp.User.LastName,
                    CampaignPersonaId = ucp.CampaignPersonaId,
                    PersonaName = ucp.CampaignPersona.DisplayName,
                    Hierarchy = ucp.CampaignPersona.Hierarchy
                })
                .OrderBy(m => m.Hierarchy)
                .ThenBy(m => m.Email)
                .ToListAsync();

            // Persona options for the reassign dropdown (so a reassign-only user has targets).
            var personas = await CampaignManagerContext.CampaignPersonas
                .AsNoTracking()
                .Where(p => p.CampaignId == campaignId)
                .OrderBy(p => p.Hierarchy)
                .Select(p => new PersonaOption
                {
                    Id = p.Id,
                    DisplayName = p.DisplayName,
                    Hierarchy = p.Hierarchy
                })
                .ToListAsync();

            return new CampaignMembersResponse
            {
                Members = members,
                Personas = personas,
                ActorLevel = actor.Level
            };
        }

        public async Task ReassignMember(Guid actorUserId, Guid campaignId, ReassignMemberRequest request)
        {
            if (request == null) throw new ArgumentNullException(nameof(request));

            var actor = await GetActorContext(actorUserId, campaignId);
            RequirePermission(actor, PermissionNames.CanReassignUsers);

            var target = await CampaignManagerContext.CampaignPersonas
                .FirstOrDefaultAsync(p => p.Id == request.ToPersonaId && p.CampaignId == campaignId)
                ?? throw new InvalidOperationException("Target persona not found in this campaign.");

            // You can only move members into personas below your own level.
            if (target.Hierarchy <= actor.Level)
                throw new UnauthorizedAccessException("You can only reassign members into personas below your own level.");

            // The member's current memberships in this campaign.
            var current = await CampaignManagerContext.UserCampaignPersonas
                .Where(ucp => ucp.UserId == request.UserId && ucp.CampaignPersona.CampaignId == campaignId)
                .Include(ucp => ucp.CampaignPersona)
                .ToListAsync();

            if (current.Count == 0)
                throw new InvalidOperationException("That user is not a member of this campaign.");

            // You can only move members who are currently below your own level.
            var memberLevel = current.Min(c => c.CampaignPersona.Hierarchy);
            if (memberLevel <= actor.Level)
                throw new UnauthorizedAccessException("You can only reassign members below your own level.");

            if (current.Any(c => c.CampaignPersonaId == request.ToPersonaId))
                return; // already there

            // Replace their campaign membership(s) with the single target persona.
            CampaignManagerContext.UserCampaignPersonas.RemoveRange(current);
            CampaignManagerContext.UserCampaignPersonas.Add(new UserCampaignPersona
            {
                UserId = request.UserId,
                CampaignPersonaId = request.ToPersonaId
            });

            await CampaignManagerContext.SaveChangesAsync();
        }

        // ---------------------------------------------------------------------
        // Authority helpers
        // ---------------------------------------------------------------------

        /// <summary>The acting user's authority within a campaign: most-privileged level,
        /// the personas they're assigned to, and the union of their granted permission names.</summary>
        private sealed class ActorContext
        {
            public int Level { get; init; }
            public HashSet<Guid> OwnedPersonaIds { get; init; } = new();
            public HashSet<string> Permissions { get; init; } = new();
        }

        private async Task<ActorContext> GetActorContext(Guid userId, Guid campaignId)
        {
            var rows = await CampaignManagerContext.UserCampaignPersonas
                .AsNoTracking()
                .Where(ucp => ucp.UserId == userId && ucp.CampaignPersona.CampaignId == campaignId)
                .Select(ucp => new
                {
                    ucp.CampaignPersonaId,
                    ucp.CampaignPersona.Hierarchy,
                    Permissions = ucp.CampaignPersona.CampaignPersonaPermissions
                        .Select(p => p.Permission.DisplayName)
                        .ToList()
                })
                .ToListAsync();

            if (rows.Count == 0)
                throw new UnauthorizedAccessException("You are not a member of this campaign.");

            return new ActorContext
            {
                Level = rows.Min(r => r.Hierarchy),
                OwnedPersonaIds = rows.Select(r => r.CampaignPersonaId).ToHashSet(),
                Permissions = rows.SelectMany(r => r.Permissions).ToHashSet()
            };
        }

        private static void RequirePermission(ActorContext actor, string permission)
        {
            if (!actor.Permissions.Contains(permission))
                throw new UnauthorizedAccessException($"You do not have the required permission ({permission}).");
        }
    }
}
