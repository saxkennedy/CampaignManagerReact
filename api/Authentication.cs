using System;
using System.IO;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Azure.WebJobs;
using Microsoft.Azure.WebJobs.Extensions.Http;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using Newtonsoft.Json;

namespace api.Authentication
{
    public static class LoginFunction
    {
        [FunctionName("Login")]
        public static async Task<IActionResult> Run(
            [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "login")] HttpRequest req,
            ILogger log)
        {
            log.LogInformation("Login function triggered.");

            string requestBody = await new StreamReader(req.Body).ReadToEndAsync();
            var loginData = JsonConvert.DeserializeObject<LoginRequest>(requestBody);

            if (string.IsNullOrWhiteSpace(loginData?.Email) || string.IsNullOrWhiteSpace(loginData?.Password))
            {
                return new BadRequestObjectResult("Email and password are required.");
            }

            // ⚠️ Simplified validation for demonstration only
            if (loginData.Email == "admin@endersgame.com" && loginData.Password == "vampjuice123")
            {
                return new OkObjectResult(new { message = "Login successful!" });
            }
            else
            {
                return new UnauthorizedObjectResult(new { message = "Invalid credentials." });
            }
        }

        public class LoginRequest
        {
            public string Email { get; set; }
            public string Password { get; set; }
        }
    }
}
