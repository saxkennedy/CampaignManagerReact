using CampaignManager.Services.Models;

namespace CampaignManager.Services.Services.Abstractions
{
    public interface ICampaignContentService
    {
        public Task<CampaignContentResponse> GetCampaignContent(Guid campaignId);
    }
}
