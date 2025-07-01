using CampaignManager.Services.Models;
using Microsoft.AspNetCore.Mvc;


namespace CampaignManager.WebApp.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class UserController : ControllerBase
    {
        //private readonly IUserService UserService;
        [HttpGet("getUser/{email}/{password}")]
        public async Task<UserResponse> GetUser(string email, string password)
        {
            try
            {
                if (email == "player@endersgame.com" && password == "pleasedontabuse")
                {
                    var playerContentAccess = new List<ContentAccess>()
                    //make a new list of ContentAccess items
                    {
                        new ContentAccess() { Name = "RealmsBetwixt", DisplayName = "Realms Betwixt Campaign Access", HasAccess = true },
                        new ContentAccess() { Name = "Public", DisplayName = "Public Campaign Details", HasAccess = true },
                        new ContentAccess() { Name = "Private", DisplayName = "Private Campaign Details", HasAccess = false }
                    };
                    return new UserResponse()
                    {
                        Id = Guid.Empty,
                        Email = email,
                        FirstName = "Guest",
                        LastName = "McGuest",
                        Persona = "Player",
                        ContentAccess = playerContentAccess
                    };
                }
                if (email == "admin@endersgame.com" && password == "vampjuice123")
                {
                    var adminContentAccess = new List<ContentAccess>()
                    //make a new list of ContentAccess items
                    {
                        new ContentAccess() { Name = "RealmsBetwixt", DisplayName = "Realms Betwixt Campaign Access", HasAccess = true },
                        new ContentAccess() { Name = "Public", DisplayName = "Public Campaign Details", HasAccess = true },
                        new ContentAccess() { Name = "Private", DisplayName = "Private Campaign Details", HasAccess = true }
                    };
                    return new UserResponse()
                    {
                        Id = Guid.Empty,
                        Email = email,
                        FirstName = "Ender",
                        LastName = "Wiggin",
                        Persona = "Admin",
                        ContentAccess = adminContentAccess
                    };
                }
                else
                {
                    return null;
                }
            }
            catch (Exception ex)
            {
                throw new Exception("An error occurred while retrieving the user.", ex);
            }
        }
    }
}