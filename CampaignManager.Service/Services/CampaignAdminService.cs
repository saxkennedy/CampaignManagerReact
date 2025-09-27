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
