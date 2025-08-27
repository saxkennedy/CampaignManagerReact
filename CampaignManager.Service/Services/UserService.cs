using CampaignManager.Services.Models;
using CampaignManager.Services.Services.Abstractions;
using Data.Models;
using Microsoft.EntityFrameworkCore;
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
                UserName = createUser.Email, // Assuming UserName is the same as Email
                DateAdded = DateTime.UtcNow,
                PersonaId = Guid.Parse("B6A68383-8651-406B-AC27-465CFD11A449")
            };
            CampaignManagerContext.Users.Add(newUser);
            CampaignManagerContext.SaveChanges();
            var user = await GetUser(createUser.Email, createUser.Password);
            return user;
        }

        public async Task<UserResponse> GetUser(string email, string password)
        {
            var response = await CampaignManagerContext.Users
                .FirstOrDefaultAsync(u => u.Email == email && u.Password == password);
            if (response != null)
            {                 
                var userResponse =  new UserResponse
                {
                    Id = response.Id,
                    Email = response.Email,
                    FirstName = response.FirstName,
                    LastName = response.LastName,
                    Persona= response.PersonaId.ToString(),
                    CampaignPersonas = await CampaignManagerContext.Procedures.GetCampaignPersonaAsync(response.Id)                  
                }; ;

                return userResponse;
            }
            else
            {
                return null; // or throw an exception, depending on your error handling strategy
            }
        }
    }
}
