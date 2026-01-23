using CampaignManager.Services.Models;
using CampaignManager.Services.Services.Abstractions;
using Data.Models;
using Microsoft.EntityFrameworkCore;
using System;
using System.Threading.Tasks;

namespace CampaignManager.Services.Services
{
    public class UserService : IUserService
    {
        private readonly CampaignManagerContext CampaignManagerContext;

        public UserService(CampaignManagerContext campaignManagerContext)
        {
            CampaignManagerContext = campaignManagerContext;
        }

        public async Task<UserResponse> CreateUser(NewUserRequest createUser)
        {
            User newUser = new User
            {
                Email = createUser.Email,
                FirstName = createUser.FirstName,
                LastName = createUser.LastName,
                Password = createUser.Password,
                UserName = createUser.Email,
                DateAdded = DateTime.UtcNow,
                PersonaId = Guid.Parse("B6A68383-8651-406B-AC27-465CFD11A449")
            };

            CampaignManagerContext.Users.Add(newUser);
            await CampaignManagerContext.SaveChangesAsync();

            // Return full user response
            return await GetUser(createUser.Email, createUser.Password);
        }

        public async Task<UserResponse> GetUser(string email, string password)
        {
            var response = await CampaignManagerContext.Users
                .FirstOrDefaultAsync(u => u.Email == email && u.Password == password);

            if (response == null) return null;

            return await BuildUserResponse(response);
        }

        public async Task<UserResponse> GetUserById(Guid userId)
        {
            var response = await CampaignManagerContext.Users
                .FirstOrDefaultAsync(u => u.Id == userId);

            if (response == null) return null;

            return await BuildUserResponse(response);
        }

        private async Task<UserResponse> BuildUserResponse(User user)
        {
            return new UserResponse
            {
                Id = user.Id,
                Email = user.Email,
                FirstName = user.FirstName,
                LastName = user.LastName,
                Persona = user.PersonaId.ToString(),

                // ✅ This is the critical part that restores access after refresh
                CampaignPersonas = await CampaignManagerContext.Procedures.GetCampaignPersonaAsync(user.Id)
            };
        }
    }
}
