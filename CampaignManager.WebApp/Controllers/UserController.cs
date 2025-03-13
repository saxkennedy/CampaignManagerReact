using CampaignManager.Services.Abstractions;
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
        public void CreateUser([FromBody] User user)
        {
            UserService.CreateUser(user);
        }
        [HttpGet("getUser/{email}/{password}")]
        public Task<User> GetUser(string email, string password)
        {
            return UserService.GetUser(email,password);
        }
    }
}