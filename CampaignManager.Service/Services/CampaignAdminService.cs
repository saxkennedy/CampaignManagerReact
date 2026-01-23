using System;
using System.Linq;
using System.Threading.Tasks;
using CampaignManager.Services.Models;
using CampaignManager.Services.Services.Abstractions;
using Data.Models;
using Microsoft.EntityFrameworkCore;

namespace CampaignManager.Services.Services
{
    public class CampaignAdminService : ICampaignAdminService
    {
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
            // ✅ CHANGE: require at least 2 personas now
            if (personas.Count < 2)
                throw new InvalidOperationException("At least two CampaignPersonas are required.");
            if (personas.Count > 10)
                throw new InvalidOperationException("A maximum of 10 CampaignPersonas is allowed.");

            // Must have exactly one hierarchy 1 persona
            var h1 = personas.Where(p => p.Hierarchy == 1).ToList();
            if (h1.Count != 1)
                throw new InvalidOperationException("Exactly one CampaignPersona must have Hierarchy = 1.");

            // Enforce unique hierarchy values to avoid ambiguity
            var dupHierarchy = personas
                .GroupBy(p => p.Hierarchy)
                .Where(g => g.Count() > 1)
                .Select(g => g.Key)
                .ToList();
            if (dupHierarchy.Any())
                throw new InvalidOperationException("CampaignPersona Hierarchy values must be unique.");

            // Validate join persona hierarchy exists in list
            var joinHierarchy = request.CampaignJoinPersonaHierarchy;
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

                if (p.Hierarchy == 1) creatorPersonaId = personaId;
                if (p.Hierarchy == joinHierarchy) joinPersonaId = personaId;
            }

            if (creatorPersonaId == Guid.Empty)
                throw new InvalidOperationException("Creator persona (Hierarchy 1) could not be resolved.");
            if (joinPersonaId == Guid.Empty)
                throw new InvalidOperationException("Join persona could not be resolved.");

            // ✅ Enforce join persona set (even though DB allows null now)
            campaign.CampaignJoinPersonaId = joinPersonaId;

            // Add creator membership at hierarchy 1
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
    }
}
