using CampaignManager.Services.Models;
using CampaignManager.Services.Services.Abstractions;
using Microsoft.AspNetCore.Mvc;


namespace CampaignManager.WebApp.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class UserController : ControllerBase
    {
        //private readonly IUserService UserService;
        private readonly ITemporaryLoginService TemporaryLoginService;
        public UserController(/*IUserService userService,*/ ITemporaryLoginService temporaryLoginService)
        {
            //UserService = userService;
            TemporaryLoginService = temporaryLoginService;
        }
        [HttpGet("getUser/{email}/{password}")]
        public async Task<UserResponse> GetUser(string email, string password)
        {
            //UserResponse response= await UserService.GetUser(email, password);
            UserResponse response = await TemporaryLoginService.GetUser(email, password);
            return response;
        }
    }
}