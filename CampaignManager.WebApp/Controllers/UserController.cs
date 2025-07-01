using CampaignManager.Services.Models;
using CampaignManager.Services.Services.Abstractions;
using Data.Models;
using Microsoft.AspNetCore.Mvc;


namespace CampaignManager.WebApp.Controllers
{
    [Route("backendApi/[controller]")]
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
        //[HttpPost]
        //[Route("createUser")]
        //public async Task<UserResponse> CreateUser( [FromBody] NewUserRequest user)
        //{
        //    UserResponse response = await  UserService.CreateUser(user);
        //    return response;
        //}
        [HttpGet("getUser/{email}/{password}")]
        public async Task<UserResponse> GetUser(string email, string password)
        {
            //UserResponse response= await UserService.GetUser(email, password);
            UserResponse response = await TemporaryLoginService.GetUser(email, password);
            return response;
        }
    }
}