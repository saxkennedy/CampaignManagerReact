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
        private readonly IEmailService emailService;
        private readonly ILogger<AuthFunctions> _log;

        public AuthFunctions(IUserService users, IEmailService email, ILogger<AuthFunctions> log)
        {
            userService = users;
            emailService = email;
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

        private sealed class VerifyEmailRequest
        {
            public string? Email { get; set; }
            public string? Code { get; set; }
        }

        private sealed class ResendRequest
        {
            public string? Email { get; set; }
        }

        private sealed class ForgotPasswordRequest
        {
            public string? Email { get; set; }
        }

        private sealed class ResetPasswordRequest
        {
            public string? Email { get; set; }
            public string? Code { get; set; }
            public string? NewPassword { get; set; }
        }

        private sealed class ChangePasswordRequest
        {
            public string? CurrentPassword { get; set; }
            public string? NewPassword { get; set; }
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
                expires: DateTime.UtcNow.AddHours(6),
                signingCredentials: creds
            );

            return new JwtSecurityTokenHandler().WriteToken(token);
        }

        /// <summary>
        /// Azure Static Web Apps can strip/override the standard "Authorization" header when proxying /api requests.
        /// We also accept a custom header "X-Ender-Auth" that SWA passes through.
        /// </summary>
        private static ClaimsPrincipal? ValidateJwt(HttpRequestData req)
        {
            string? token = null;

            if (req.Headers.TryGetValues("X-Ender-Auth", out var xauthHeaders))
                token = xauthHeaders.FirstOrDefault();

            if (string.IsNullOrWhiteSpace(token) && req.Headers.TryGetValues("Authorization", out var authHeaders))
            {
                var auth = authHeaders.FirstOrDefault();
                if (!string.IsNullOrWhiteSpace(auth) && auth.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
                    token = auth.Substring("Bearer ".Length).Trim();
            }

            if (!string.IsNullOrWhiteSpace(token) && token.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
                token = token.Substring("Bearer ".Length).Trim();

            if (string.IsNullOrWhiteSpace(token))
                return null;

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

            if (!user.IsVerified)
            {
                var forbidden = req.CreateResponse(HttpStatusCode.Forbidden);
                await forbidden.WriteAsJsonAsync(new { error = "Please verify your email before logging in.", unverified = true });
                return forbidden;
            }

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
            if (create == null || string.IsNullOrWhiteSpace(create.Email) || string.IsNullOrWhiteSpace(create.Password))
            {
                var bad = req.CreateResponse(HttpStatusCode.BadRequest);
                await bad.WriteAsJsonAsync(new { error = "Email and password are required." });
                return bad;
            }

            UserResponse user;
            try
            {
                user = await userService.CreateUser(create);
            }
            catch (InvalidOperationException ex)
            {
                var conflict = req.CreateResponse(HttpStatusCode.Conflict);
                await conflict.WriteAsJsonAsync(new { error = ex.Message });
                return conflict;
            }

            var code = await userService.CreateVerificationCode(user.Id);

            try
            {
                await emailService.SendVerificationEmailAsync(create.Email, code);
            }
            catch (Exception ex)
            {
                _log.LogError(ex, "Failed to send verification email to {Email}", create.Email);
                await userService.DeleteUser(user.Id);
                var err = req.CreateResponse(HttpStatusCode.InternalServerError);
                await err.WriteAsJsonAsync(new { error = "Failed to send verification email. Please try again." });
                return err;
            }

            var ok = req.CreateResponse(HttpStatusCode.OK);
            await ok.WriteAsJsonAsync(new { email = create.Email });
            return ok;
        }

        [Function("VerifyEmail")]
        public async Task<HttpResponseData> VerifyEmail(
            [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "verifyEmail")] HttpRequestData req)
        {
            var body = await ReadBodyAsync<VerifyEmailRequest>(req);
            if (body == null || string.IsNullOrWhiteSpace(body.Email) || string.IsNullOrWhiteSpace(body.Code))
            {
                var bad = req.CreateResponse(HttpStatusCode.BadRequest);
                await bad.WriteAsJsonAsync(new { error = "Email and code are required." });
                return bad;
            }

            var verified = await userService.VerifyUser(body.Email, body.Code);
            if (!verified)
            {
                var bad = req.CreateResponse(HttpStatusCode.BadRequest);
                await bad.WriteAsJsonAsync(new { error = "Invalid or expired code." });
                return bad;
            }

            return req.CreateResponse(HttpStatusCode.OK);
        }

        [Function("ChangePassword")]
        public async Task<HttpResponseData> ChangePassword(
            [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "changePassword")] HttpRequestData req)
        {
            var principal = ValidateJwt(req);
            if (principal == null)
                return req.CreateResponse(HttpStatusCode.Unauthorized);

            var idStr = principal.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (!Guid.TryParse(idStr, out var userId))
                return req.CreateResponse(HttpStatusCode.Unauthorized);

            var body = await ReadBodyAsync<ChangePasswordRequest>(req);
            if (body == null || string.IsNullOrWhiteSpace(body.CurrentPassword) || string.IsNullOrWhiteSpace(body.NewPassword))
            {
                var bad = req.CreateResponse(HttpStatusCode.BadRequest);
                await bad.WriteAsJsonAsync(new { error = "Current and new password are required." });
                return bad;
            }

            var success = await userService.ChangePassword(userId, body.CurrentPassword, body.NewPassword);
            if (!success)
            {
                var bad = req.CreateResponse(HttpStatusCode.BadRequest);
                await bad.WriteAsJsonAsync(new { error = "Current password is incorrect." });
                return bad;
            }

            return req.CreateResponse(HttpStatusCode.OK);
        }

        [Function("VerifyResetCode")]
        public async Task<HttpResponseData> VerifyResetCode(
            [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "verifyResetCode")] HttpRequestData req)
        {
            var body = await ReadBodyAsync<VerifyEmailRequest>(req);
            if (body == null || string.IsNullOrWhiteSpace(body.Email) || string.IsNullOrWhiteSpace(body.Code))
            {
                var bad = req.CreateResponse(HttpStatusCode.BadRequest);
                await bad.WriteAsJsonAsync(new { error = "Email and code are required." });
                return bad;
            }

            var valid = await userService.IsResetCodeValid(body.Email, body.Code);
            if (!valid)
            {
                var bad = req.CreateResponse(HttpStatusCode.BadRequest);
                await bad.WriteAsJsonAsync(new { error = "Invalid or expired code." });
                return bad;
            }

            return req.CreateResponse(HttpStatusCode.OK);
        }

        [Function("ForgotPassword")]
        public async Task<HttpResponseData> ForgotPassword(
            [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "forgotPassword")] HttpRequestData req)
        {
            var body = await ReadBodyAsync<ForgotPasswordRequest>(req);
            if (body == null || string.IsNullOrWhiteSpace(body.Email))
            {
                var bad = req.CreateResponse(HttpStatusCode.BadRequest);
                await bad.WriteAsJsonAsync(new { error = "Email is required." });
                return bad;
            }

            var user = await userService.GetUserByEmail(body.Email);
            if (user != null)
            {
                var code = await userService.CreatePasswordResetCode(user.Id);
                try
                {
                    await emailService.SendPasswordResetEmailAsync(body.Email, code);
                }
                catch (Exception ex)
                {
                    _log.LogError(ex, "Failed to send password reset email to {Email}", body.Email);
                }
            }

            // Always return OK — don't leak whether the email exists
            return req.CreateResponse(HttpStatusCode.OK);
        }

        [Function("ResetPassword")]
        public async Task<HttpResponseData> ResetPassword(
            [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "resetPassword")] HttpRequestData req)
        {
            var body = await ReadBodyAsync<ResetPasswordRequest>(req);
            if (body == null || string.IsNullOrWhiteSpace(body.Email) ||
                string.IsNullOrWhiteSpace(body.Code) || string.IsNullOrWhiteSpace(body.NewPassword))
            {
                var bad = req.CreateResponse(HttpStatusCode.BadRequest);
                await bad.WriteAsJsonAsync(new { error = "Email, code, and new password are required." });
                return bad;
            }

            var success = await userService.ResetPassword(body.Email, body.Code, body.NewPassword);
            if (!success)
            {
                var bad = req.CreateResponse(HttpStatusCode.BadRequest);
                await bad.WriteAsJsonAsync(new { error = "Invalid or expired code." });
                return bad;
            }

            return req.CreateResponse(HttpStatusCode.OK);
        }

        [Function("ResendVerification")]
        public async Task<HttpResponseData> ResendVerification(
            [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "resendVerification")] HttpRequestData req)
        {
            var body = await ReadBodyAsync<ResendRequest>(req);
            if (body == null || string.IsNullOrWhiteSpace(body.Email))
            {
                var bad = req.CreateResponse(HttpStatusCode.BadRequest);
                await bad.WriteAsJsonAsync(new { error = "Email is required." });
                return bad;
            }

            var user = await userService.GetUnverifiedUser(body.Email);
            if (user == null)
            {
                // Return OK regardless — don't leak whether the email exists
                return req.CreateResponse(HttpStatusCode.OK);
            }

            var code = await userService.CreateVerificationCode(user.Id);

            try
            {
                await emailService.SendVerificationEmailAsync(body.Email, code);
            }
            catch (Exception ex)
            {
                _log.LogError(ex, "Failed to resend verification email to {Email}", body.Email);
                var err = req.CreateResponse(HttpStatusCode.InternalServerError);
                await err.WriteAsJsonAsync(new { error = "Failed to send email. Please try again." });
                return err;
            }

            return req.CreateResponse(HttpStatusCode.OK);
        }
    }
}
