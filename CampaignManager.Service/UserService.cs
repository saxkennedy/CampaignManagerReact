using CampaignManager.Services.Abstractions;
using Data.Models;
using Microsoft.EntityFrameworkCore;

namespace CampaignManager.Services
{
    public class UserService : IUserService
    {
        private readonly CampaignManagerContext CampaignManagerContext;

        public UserService(CampaignManagerContext campaignManagerContext)
        {
            CampaignManagerContext = campaignManagerContext;
        }

        public void CreateUser(User createUser)
        {           
            CampaignManagerContext.Users.Add(createUser);
            CampaignManagerContext.SaveChanges();
        }

        public Task<User> GetUser(string email,string password)
        {
            return CampaignManagerContext.Users.FirstOrDefaultAsync(u => u.Email == email && u.Password == password);
        }
    }
}
