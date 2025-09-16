using CampaignManager.Services.Models;

namespace CampaignManager.Services.Services.Abstractions
{
    public interface ICampaignAdminService
    {
        public Task<CampaignContentResponse> GetAdminCampaignContent(Guid campaignId);
        public Task<string> CRUDContent(CRUDContentRequest createUser);
        //public Task<string> CRUDNPC(CRUDNPCRequest npcRequest);
    }
}
