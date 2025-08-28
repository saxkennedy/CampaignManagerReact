using System;
using System.IO;
using System.Net;
using System.Text.Json;
using System.Threading.Tasks;
using CampaignManager.Services.Models;                 // AddContentRequest
using CampaignManager.Services.Services.Abstractions; // ICampaignAdminService
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Logging;

namespace api
{
    // Keep this file name as CampaignAdmin.cs
    public class CampaignAdminFunctions
    {
        private readonly ICampaignAdminService _service;
        private readonly ILogger<CampaignAdminFunctions> _log;

        public CampaignAdminFunctions(ICampaignAdminService service, ILogger<CampaignAdminFunctions> log)
        {
            _service = service;
            _log = log;
        }

        // POST /api/campaignadmin/{campaignId}/content
        [Function("CampaignAdmin_AddContent")]
        public async Task<HttpResponseData> AddContent(
            [HttpTrigger(AuthorizationLevel.Anonymous, "post",
                         Route = "campaignadmin/{campaignId}/content")]
            HttpRequestData req,
            string campaignId)
        {
            // Parse route campaignId
            if (!Guid.TryParse(campaignId, out var cid))
            {
                var bad = req.CreateResponse(HttpStatusCode.BadRequest);
                await bad.WriteStringAsync("Failed. Invalid campaignId.");
                return bad;
            }

            // Read body
            AddContentRequest body;
            try
            {
                using var reader = new StreamReader(req.Body);
                var json = await reader.ReadToEndAsync();
                body = JsonSerializer.Deserialize<AddContentRequest>(json, new JsonSerializerOptions
                {
                    PropertyNameCaseInsensitive = true
                });
            }
            catch (Exception ex)
            {
                _log.LogWarning(ex, "Invalid JSON body for AddContent.");
                var bad = req.CreateResponse(HttpStatusCode.BadRequest);
                await bad.WriteStringAsync("Failed. Invalid JSON body.");
                return bad;
            }

            if (body == null)
            {
                var bad = req.CreateResponse(HttpStatusCode.BadRequest);
                await bad.WriteStringAsync("Failed. Body is required.");
                return bad;
            }

            // Keep it simple: trust the route and stamp the CampaignId from it
            body.CampaignId = cid;

            // Call your services layer (returns "Success" or "Failed. …")
            string result;
            try
            {
                result = await _service.AddContent(body);
            }
            catch (Exception ex)
            {
                _log.LogError(ex, "Service threw while adding content.");
                result = "Failed. " + ex.Message;
            }

            // Plain text response, status based on prefix
            if (result.StartsWith("Success", StringComparison.OrdinalIgnoreCase))
            {
                var ok = req.CreateResponse(HttpStatusCode.Created);
                ok.Headers.Add("Content-Type", "text/plain; charset=utf-8");
                await ok.WriteStringAsync(result);
                return ok;
            }
            else
            {
                var bad = req.CreateResponse(HttpStatusCode.BadRequest);
                bad.Headers.Add("Content-Type", "text/plain; charset=utf-8");
                await bad.WriteStringAsync(result);
                return bad;
            }
        }
    }
}
