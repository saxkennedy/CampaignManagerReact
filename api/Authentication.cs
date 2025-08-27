using System.IO;
using System.Text.Json;
using System.Threading.Tasks;
using CampaignManager.Services.Services.Abstractions; // IUserService
using CampaignManager.Services.Models;               // UserResponse
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Logging;

namespace api.Authentication
{
    public class LoginFunction
    {
        private readonly IUserService userService;
        private readonly ILogger<LoginFunction> _log;

        public LoginFunction(IUserService users, ILogger<LoginFunction> log)
        {
            userService = users;
            _log = log;
        }

        private sealed class LoginRequest
        {
            public string Email { get; set; }
            public string Password { get; set; }
        }

        [Function("Login")]
        public async Task<HttpResponseData> GetUser(
            [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "login")]
            HttpRequestData req)
        {
            _log.LogInformation("Login function triggered (isolated worker).");

            // Read and deserialize request body
            string body;
            using (var reader = new StreamReader(req.Body))
                body = await reader.ReadToEndAsync();

            LoginRequest login;
            try
            {
                login = JsonSerializer.Deserialize<LoginRequest>(body, new JsonSerializerOptions
                {
                    PropertyNameCaseInsensitive = true
                });
            }
            catch
            {
                var badJson = req.CreateResponse(System.Net.HttpStatusCode.BadRequest);
                await badJson.WriteAsJsonAsync(new { error = "Invalid JSON body." });
                return badJson;
            }

            if (login == null || string.IsNullOrWhiteSpace(login.Email) || string.IsNullOrWhiteSpace(login.Password))
            {
                var badRequest = req.CreateResponse(System.Net.HttpStatusCode.BadRequest);
                await badRequest.WriteAsJsonAsync(new { error = "Email and password are required." });
                return badRequest;
            }

            var user = await userService.GetUser(login.Email, login.Password);
            if (user == null)
            {
                var unauthorized = req.CreateResponse(System.Net.HttpStatusCode.Unauthorized);
                return unauthorized;
            }

            var ok = req.CreateResponse(System.Net.HttpStatusCode.OK);
            await ok.WriteAsJsonAsync<UserResponse>(user); // returns your service DTO directly
            return ok;
        }
    }
}
