using CampaignManager.Services.Models;

namespace CampaignManager.Services.Services.Abstractions
{
    public interface ICampaignAdminService
    {
        public Task<string> CRUDContent(CRUDContentRequest createUser);
    }
}
