using CampaignManager.Services.Models;
using CampaignManager.Services.Services.Abstractions;
using Data.Models;
using Microsoft.EntityFrameworkCore;
using System.Threading.Tasks;

namespace CampaignManager.Services.Services
{
    public class CampaignAdminService : ICampaignAdminService
    {
        private readonly CampaignManagerContext CampaignManagerContext;

        public CampaignAdminService(CampaignManagerContext campaignManagerContext)
        {
            CampaignManagerContext = campaignManagerContext;
        }

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
                else { 
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
                entry.ContentTypeId = request.ContentType;
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
                        ContentTypeId = request.ContentType
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

        public async Task<CampaignContentResponse> GetAdminCampaignContent(Guid campaignId)
        {
             
            var contents = await CampaignManagerContext.CampaignCategoryContentXrefs
                .AsNoTracking()
                .Where(c => c.CampaignId == campaignId)
                .Select(c => new CampaignCategoryContentXref
                {
                    Id = c.Id,
                    CampaignId = c.CampaignId,
                    ParentContentId = c.ParentContentId,
                    CreatorId = c.CreatorId,
                    DisplayName = c.DisplayName,
                    Description = c.Description,
                    AccessHierarchyLevel = c.AccessHierarchyLevel,
                    ContentLink = c.ContentLink,
                    IconLink = c.IconLink,
                    SimpleContent = c.SimpleContent,
                    ContentType = c.ContentType
                })
                .ToListAsync();
            var campaignPersonas = await CampaignManagerContext.CampaignPersonas
                .AsNoTracking()
                .Where(cp => cp.CampaignId == campaignId)
                .ToListAsync();
            var contentTypes = await CampaignManagerContext.ContentTypes
                .AsNoTracking()
                .ToListAsync();
            var response = new CampaignContentResponse
            {
                CampaignContent = contents,
                CampaignPersonas = campaignPersonas,
                ContentTypes = contentTypes
            };            
            return response;
        }
    }
}
