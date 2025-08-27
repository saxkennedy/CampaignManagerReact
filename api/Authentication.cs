using CampaignManager.Services.Models;               // UserResponse
using CampaignManager.Services.Services.Abstractions; // IUserService
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Logging;
using System.IO;
using System.Net;
using System.Text.Json;
using System.Threading.Tasks;

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
        private static readonly JsonSerializerOptions JsonOpts = new()
        {
            PropertyNameCaseInsensitive = true
        };
        private static async Task<T> ReadBodyAsync<T>(HttpRequestData req)
        {
            using var reader = new StreamReader(req.Body);
            var body = await reader.ReadToEndAsync();
            return JsonSerializer.Deserialize<T>(body, JsonOpts);
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

        [Function("CreateUser")]
        public async Task<HttpResponseData> CreateUser(
            [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "createUser")] HttpRequestData req)
        {
            var create = await ReadBodyAsync<NewUserRequest>(req);
            var newUser = await userService.CreateUser(create);

            var response = req.CreateResponse(HttpStatusCode.Created);
            await response.WriteAsJsonAsync(newUser);
            return response;
        }
    }
}
