using CampaignManager.Services.Models;
using CampaignManager.Services.Services.Abstractions;
using Data.Models;
using Microsoft.EntityFrameworkCore;
using System.Threading.Tasks;

namespace CampaignManager.Services.Services
{
    public class CampaignContentService : ICampaignContentService
    {
        private readonly CampaignManagerContext CampaignManagerContext;

        public CampaignContentService(CampaignManagerContext campaignManagerContext)
        {
            CampaignManagerContext = campaignManagerContext;
        }


        public async Task<CampaignContentResponse> GetCampaignContent(Guid campaignId)
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
