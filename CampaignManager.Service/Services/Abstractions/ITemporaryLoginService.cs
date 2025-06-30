using CampaignManager.Services.Models;


namespace CampaignManager.Services.Services.Abstractions
{
    public interface ITemporaryLoginService
    {
        public Task<UserResponse> GetUser(string email, string password);
    }
}
