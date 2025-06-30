using CampaignManager.Services.Models;
using Data.Models;

namespace CampaignManager.Services.Services.Abstractions
{
    public interface IUserService
    {
        public Task<UserResponse> CreateUser(NewUserRequest user);
        public Task<UserResponse> GetUser(string email, string password);
    }
}
