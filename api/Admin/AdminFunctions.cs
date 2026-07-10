using System;
using System.IO;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Security.Claims;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using CampaignManager.Services.BastionSeeding;
using Data.Models;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;

namespace api.Admin
{
    /// <summary>
    /// Site-admin-only tooling. Every endpoint here must pass <see cref="RequireSiteAdmin"/>:
    /// the caller's SitePersona.DisplayName must be "Administrator". Never trust the client;
    /// the Admin nav tab is only a convenience — this is the real gate.
    /// </summary>
    public class AdminFunctions
    {
        private const string AdminPersonaName = "Administrator";

        private readonly CampaignManagerContext _db;
        private readonly IHttpClientFactory _httpFactory;
        private readonly IEmailService _email;
        private readonly ILogger<AdminFunctions> _log;

        public AdminFunctions(CampaignManagerContext db, IHttpClientFactory httpFactory, IEmailService email, ILogger<AdminFunctions> log)
        {
            _db = db;
            _httpFactory = httpFactory;
            _email = email;
            _log = log;
        }

        // POST /api/admin/seed/bastion-facilities
        // Delegates to the shared BastionSeeder (same code the BastionSeed CLI runs), so the
        // button and the manual tool can never drift.
        [Function("Admin_SeedBastionFacilities")]
        public async Task<HttpResponseData> SeedBastionFacilities(
            [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "siteadmin/seed/bastion-facilities")] HttpRequestData req)
        {
            var (ok, principal) = ValidateJwt(req);
            if (!ok) return req.CreateResponse(HttpStatusCode.Unauthorized);

            if (!await RequireSiteAdmin(principal!))
                return await Json(req, HttpStatusCode.Forbidden, new { error = "Administrator access required." });

            try
            {
                var client = _httpFactory.CreateClient();
                client.Timeout = TimeSpan.FromSeconds(60);

                var summary = await BastionSeeder.SeedAsync(_db, client);

                return await Json(req, HttpStatusCode.OK, new
                {
                    total = summary.Total,
                    inserted = summary.Inserted,
                    updated = summary.Updated,
                    unchanged = summary.Unchanged,
                    excludedCount = summary.ExcludedCount,
                    excluded = summary.Excluded,
                });
            }
            catch (HttpRequestException ex)
            {
                _log.LogError(ex, "Failed to fetch 5etools bastion source data.");
                return await Json(req, HttpStatusCode.BadGateway,
                    new { error = "Could not fetch source data from the 5etools mirror." });
            }
            catch (Exception ex)
            {
                _log.LogError(ex, "Bastion facility seed failed.");
                return await Json(req, HttpStatusCode.InternalServerError,
                    new { error = "The seed operation failed." });
            }
        }

        // POST /api/admin/test-email   body: { "to": "someone@example.com" } (optional; defaults to caller)
        // Sends a real test email so an admin can confirm SMTP works in one click. The raw
        // provider error (e.g. "535 Authentication failed") is returned — safe here since the
        // endpoint is admin-only, and it's exactly what you need to diagnose delivery.
        [Function("Admin_SendTestEmail")]
        public async Task<HttpResponseData> SendTestEmail(
            [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "siteadmin/test-email")] HttpRequestData req)
        {
            var (ok, principal) = ValidateJwt(req);
            if (!ok) return req.CreateResponse(HttpStatusCode.Unauthorized);

            if (!await RequireSiteAdmin(principal!))
                return await Json(req, HttpStatusCode.Forbidden, new { error = "Administrator access required." });

            var body = await ReadJson<TestEmailRequest>(req);
            var to = body?.To;
            if (string.IsNullOrWhiteSpace(to))
                to = principal!.FindFirst(ClaimTypes.Email)?.Value;
            if (string.IsNullOrWhiteSpace(to))
                return await Json(req, HttpStatusCode.BadRequest, new { error = "No recipient address available." });

            try
            {
                await _email.SendTestEmailAsync(to);
                return await Json(req, HttpStatusCode.OK, new { sent = true, to });
            }
            catch (Exception ex)
            {
                _log.LogError(ex, "Admin test email to {To} failed.", to);
                return await Json(req, HttpStatusCode.BadGateway, new { error = ex.Message });
            }
        }

        private sealed class TestEmailRequest
        {
            public string? To { get; set; }
        }

        private static async Task<T?> ReadJson<T>(HttpRequestData req)
        {
            try
            {
                using var reader = new StreamReader(req.Body);
                var s = await reader.ReadToEndAsync();
                if (string.IsNullOrWhiteSpace(s)) return default;
                return JsonSerializer.Deserialize<T>(s, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
            }
            catch
            {
                return default;
            }
        }

        // ---------- admin gate ----------

        private async Task<bool> RequireSiteAdmin(ClaimsPrincipal principal)
        {
            var idStr = principal.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (!Guid.TryParse(idStr, out var userId))
                return false;

            var displayName = await (
                from u in _db.Users.AsNoTracking()
                join p in _db.SitePersonas.AsNoTracking() on u.PersonaId equals p.Id
                where u.Id == userId
                select p.DisplayName
            ).FirstOrDefaultAsync();

            return string.Equals(displayName, AdminPersonaName, StringComparison.OrdinalIgnoreCase);
        }

        // ---------- shared plumbing (mirrors BastionFacilityFunctions) ----------

        private static async Task<HttpResponseData> Json(HttpRequestData req, HttpStatusCode code, object body)
        {
            var res = req.CreateResponse(code);
            await res.WriteAsJsonAsync(body);
            return res;
        }

        private static (bool ok, ClaimsPrincipal? principal) ValidateJwt(HttpRequestData req)
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
                return (false, null);

            var secret = Environment.GetEnvironmentVariable("JwtSecret");
            if (string.IsNullOrWhiteSpace(secret) || secret.Length < 32)
                return (false, null);

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
                return (true, principal);
            }
            catch
            {
                return (false, null);
            }
        }
    }
}
