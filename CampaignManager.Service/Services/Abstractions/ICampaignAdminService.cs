using CampaignManager.Services.Models;

namespace CampaignManager.Services.Services.Abstractions
{
    public interface ICampaignAdminService
    {
        Task<string> CRUDContent(CRUDContentRequest createUser);
        Task<CreateCampaignResponse> CreateCampaign(Guid creatorUserId, CampaignUpsertRequest request);
    }
}
