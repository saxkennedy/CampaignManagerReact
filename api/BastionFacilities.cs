using System;
using System.Linq;
using System.Net;
using System.Security.Claims;
using System.Text;
using System.Threading.Tasks;
using Data.Models;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;

namespace api
{
    public class BastionFacilityFunctions
    {
        private readonly CampaignManagerContext _db;
        private readonly ILogger<BastionFacilityFunctions> _log;

        public BastionFacilityFunctions(CampaignManagerContext db, ILogger<BastionFacilityFunctions> log)
        {
            _db = db;
            _log = log;
        }

        /// <summary>
        /// IMPORTANT:
        /// Azure Static Web Apps can strip/override the standard "Authorization" header when proxying /api requests.
        /// So we also accept a custom header "X-Ender-Auth" that SWA passes through. (Mirrors CampaignFunctions.)
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
                return handler.ValidateToken(token, new TokenValidationParameters
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
            }
            catch
            {
                return null;
            }
        }

        // ---------- LIST ----------
        // GET /api/bastionfacilities
        // Returns the full reference catalog. The *Json columns are stored as raw JSON strings;
        // we pass them through untouched so the client can parse/shape them as the UI evolves.
        [Function("BastionFacilities_List")]
        public async Task<HttpResponseData> List(
            [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "bastionfacilities")] HttpRequestData req)
        {
            var principal = ValidateJwt(req);
            if (principal == null)
                return req.CreateResponse(HttpStatusCode.Unauthorized);

            var rows = await _db.Set<BastionFacility>()
                .AsNoTracking()
                .OrderBy(f => f.Name)
                .Select(f => new
                {
                    id = f.Id,
                    name = f.Name,
                    facilityType = f.FacilityType,
                    levelRequired = f.LevelRequired,
                    spaceJson = f.SpaceJson,
                    hirelingsJson = f.HirelingsJson,
                    ordersJson = f.OrdersJson,
                    prerequisiteJson = f.PrerequisiteJson,
                    descriptionMarkdown = f.DescriptionMarkdown,
                    sourceBook = f.SourceBook,
                    page = f.Page
                })
                .ToListAsync();

            var ok = req.CreateResponse(HttpStatusCode.OK);
            await ok.WriteAsJsonAsync(rows);
            return ok;
        }
    }
}
