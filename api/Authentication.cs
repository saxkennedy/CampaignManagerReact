using CampaignManager.Services.Models;
using CampaignManager.Services.Services.Abstractions;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Logging;
using Microsoft.IdentityModel.Tokens;
using System;
using System.IdentityModel.Tokens.Jwt;
using System.IO;
using System.Linq;
using System.Net;
using System.Security.Claims;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;

namespace api.Authentication
{
    public class AuthFunctions
    {
        private readonly IUserService userService;
        private readonly ILogger<AuthFunctions> _log;

        public AuthFunctions(IUserService users, ILogger<AuthFunctions> log)
        {
            userService = users;
            _log = log;
        }

        private static readonly JsonSerializerOptions JsonOpts = new()
        {
            PropertyNameCaseInsensitive = true
        };

        private static async Task<T?> ReadBodyAsync<T>(HttpRequestData req)
        {
            using var reader = new StreamReader(req.Body);
            var body = await reader.ReadToEndAsync();
            return JsonSerializer.Deserialize<T>(body, JsonOpts);
        }

        private sealed class LoginRequest
        {
            public string? Email { get; set; }
            public string? Password { get; set; }
        }

        private static string GenerateJwt(UserResponse user)
        {
            var secret = Environment.GetEnvironmentVariable("JwtSecret");
            if (string.IsNullOrWhiteSpace(secret) || secret.Length < 32)
                throw new InvalidOperationException("JwtSecret missing/too short. Use 32+ chars.");

            var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secret));
            var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

            var claims = new[]
            {
                new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
                new Claim(ClaimTypes.Email, user.Email ?? "")
            };

            var token = new JwtSecurityToken(
                issuer: "enderdnd",
                audience: "enderdnd",
                claims: claims,
                notBefore: DateTime.UtcNow,
                expires: DateTime.UtcNow.AddHours(4), // ✅ 4 hours total lifetime
                signingCredentials: creds
            );

            return new JwtSecurityTokenHandler().WriteToken(token);
        }

        private static ClaimsPrincipal? ValidateJwt(HttpRequestData req)
        {
            if (!req.Headers.TryGetValues("Authorization", out var authHeaders))
                return null;

            var auth = authHeaders.FirstOrDefault();
            if (string.IsNullOrWhiteSpace(auth) || !auth.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
                return null;

            var token = auth.Substring("Bearer ".Length).Trim();

            var secret = Environment.GetEnvironmentVariable("JwtSecret");
            if (string.IsNullOrWhiteSpace(secret) || secret.Length < 32)
                return null;

            try
            {
                var handler = new JwtSecurityTokenHandler();
                var principal = handler.ValidateToken(token, new TokenValidationParameters
                {
                    ValidateIssuerSigningKey = true,
                    IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secret)),
                    ValidateIssuer = true,
                    ValidIssuer = "enderdnd",
                    ValidateAudience = true,
                    ValidAudience = "enderdnd",
                    ValidateLifetime = true,
                    ClockSkew = TimeSpan.FromMinutes(1)
                }, out _);

                return principal;
            }
            catch
            {
                return null;
            }
        }

        [Function("Login")]
        public async Task<HttpResponseData> Login(
            [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "login")] HttpRequestData req)
        {
            var login = await ReadBodyAsync<LoginRequest>(req);
            if (login == null || string.IsNullOrWhiteSpace(login.Email) || string.IsNullOrWhiteSpace(login.Password))
            {
                var bad = req.CreateResponse(HttpStatusCode.BadRequest);
                await bad.WriteAsJsonAsync(new { error = "Email and password are required." });
                return bad;
            }

            var user = await userService.GetUser(login.Email, login.Password);
            if (user == null)
                return req.CreateResponse(HttpStatusCode.Unauthorized);

            var token = GenerateJwt(user);

            var ok = req.CreateResponse(HttpStatusCode.OK);
            await ok.WriteAsJsonAsync(new { user, token });
            return ok;
        }

        [Function("Me")]
        public async Task<HttpResponseData> Me(
            [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "me")] HttpRequestData req)
        {
            var principal = ValidateJwt(req);
            if (principal == null)
                return req.CreateResponse(HttpStatusCode.Unauthorized);

            var idStr = principal.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (!Guid.TryParse(idStr, out var userId))
                return req.CreateResponse(HttpStatusCode.Unauthorized);

            var user = await userService.GetUserById(userId);
            if (user == null)
                return req.CreateResponse(HttpStatusCode.Unauthorized);

            var ok = req.CreateResponse(HttpStatusCode.OK);
            await ok.WriteAsJsonAsync(user);
            return ok;
        }

        [Function("CreateUser")]
        public async Task<HttpResponseData> CreateUser(
            [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "createUser")] HttpRequestData req)
        {
            var create = await ReadBodyAsync<NewUserRequest>(req);
            if (create == null)
            {
                var bad = req.CreateResponse(HttpStatusCode.BadRequest);
                await bad.WriteAsJsonAsync(new { error = "Invalid body." });
                return bad;
            }

            var user = await userService.CreateUser(create);
            var token = GenerateJwt(user);

            var created = req.CreateResponse(HttpStatusCode.Created);
            await created.WriteAsJsonAsync(new { user, token });
            return created;
        }
    }
}
