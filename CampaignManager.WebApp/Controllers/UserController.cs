using CampaignManager.Services.Abstractions;
using CampaignManager.Services.Models;
using Data.Models;
using Microsoft.AspNetCore.Mvc;


namespace CampaignManager.WebApp.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class UserController : ControllerBase
    {
        private readonly IUserService UserService;
        public UserController(IUserService userService)
        {
            UserService = userService;
        }
        [HttpPost]
        [Route("createUser")]
        public async Task<UserResponse> CreateUser( [FromBody] NewUserRequest user)
        {
            UserResponse response = await  UserService.CreateUser(user);
            return response;
        }
        [HttpGet("getUser/{email}/{password}")]
        public async Task<UserResponse> GetUser(string email, string password)
        {
            UserResponse response= await UserService.GetUser(email, password);
            return response;
        }
    }
}