using System;
using System.IO;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Azure.WebJobs;
using Microsoft.Azure.WebJobs.Extensions.Http;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using Newtonsoft.Json;
using System.Collections.Generic;
using api.Models;

namespace api.Authentication
{
    public static class LoginFunction
    {
        [FunctionName("Login")]
        public static async Task<UserResponse> Run(
            [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "login")] HttpRequest req,
            ILogger log)
        {
            log.LogInformation("Login function triggered.");

            string requestBody = await new StreamReader(req.Body).ReadToEndAsync();
            var loginData = JsonConvert.DeserializeObject<LoginRequest>(requestBody);
            var email = loginData.Email;
            var password = loginData.Password;

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

        public class LoginRequest
        {
            public string Email { get; set; }
            public string Password { get; set; }
        }
    }
}
