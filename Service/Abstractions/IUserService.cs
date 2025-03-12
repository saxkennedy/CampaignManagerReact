using Data.Models;

namespace CampaignManager.Services.Abstractions
{
    public interface IUserService
    {
        public void CreateUser(User user);
        public Task<User> GetUser(string email);
    }
}
