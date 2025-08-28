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

        public async Task<string> AddContent(AddContentRequest request)
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
                };
                CampaignManagerContext.CampaignCategoryContentXrefs.Add(entry);
                CampaignManagerContext.SaveChanges();

                return "Success";
            }
            catch (Exception ex)
            {
                return "Failed.  " + ex.Message;
            }

        }

    }
}
