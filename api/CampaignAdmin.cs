using CampaignManager.Services.Models;                 // CRUDContentRequest
using CampaignManager.Services.Services;
using CampaignManager.Services.Services.Abstractions; // ICampaignAdminService
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Logging;
using System;
using System.IO;
using System.Net;
using System.Text.Json;
using System.Threading.Tasks;

namespace api
{
    // Keep this file name as CampaignAdmin.cs
    public class CampaignAdminFunctions
    {
        private readonly ICampaignAdminService CampaignAdminService;
        private readonly ILogger<CampaignAdminFunctions> _log;

        public CampaignAdminFunctions(ICampaignAdminService campaignAdminService, ILogger<CampaignAdminFunctions> log)
        {
            CampaignAdminService = campaignAdminService;
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
                await bad.WriteAsJsonAsync("Failed. Invalid campaignId.");
                return bad;
            }

            // Read body
            CRUDContentRequest body;
            try
            {
                using var reader = new StreamReader(req.Body);
                var json = await reader.ReadToEndAsync();
                body = JsonSerializer.Deserialize<CRUDContentRequest>(json, new JsonSerializerOptions
                {
                    PropertyNameCaseInsensitive = true
                });
            }
            catch (Exception ex)
            {
                _log.LogWarning(ex, "Invalid JSON body for AddContent.");
                var bad = req.CreateResponse(HttpStatusCode.BadRequest);
                await bad.WriteAsJsonAsync("Failed. Invalid JSON body.");
                return bad;
            }

            if (body == null)
            {
                var bad = req.CreateResponse(HttpStatusCode.BadRequest);
                await bad.WriteAsJsonAsync("Failed. Body is required.");
                return bad;
            }

            // Trust the route and stamp the CampaignId from it
            body.CampaignId = cid;

            // Call your services layer (returns "Success" or "Failed. …")
            string result;
            try
            {
                result = await CampaignAdminService.CRUDContent(body);
            }
            catch (Exception ex)
            {
                _log.LogError(ex, "Service threw while adding content.");
                result = "Failed. " + ex.Message;
            }

            // Return JSON so client .json() works
            if (result.StartsWith("Success", StringComparison.OrdinalIgnoreCase))
            {
                var created = req.CreateResponse(HttpStatusCode.Created);
                await created.WriteAsJsonAsync("Success"); // -> JSON string "Success"
                return created;
            }
            else
            {
                var bad = req.CreateResponse(HttpStatusCode.BadRequest);
                await bad.WriteAsJsonAsync(result); // -> JSON string "Failed. …"
                return bad;
            }
        }

        [Function("CampaignAdmin_GetContent")]
        public async Task<HttpResponseData> GetAdminContent(
            [HttpTrigger(AuthorizationLevel.Anonymous, "get",
                         Route = "campaignadmin/{campaignId}/structure")]
            HttpRequestData req,
            string campaignId)
        {
            _log.LogInformation("Get Admin Content Function triggered (isolated worker).");

            var response = await CampaignAdminService.GetAdminCampaignContent(Guid.Parse(campaignId));

            var ok = req.CreateResponse(HttpStatusCode.OK);
            await ok.WriteAsJsonAsync<CampaignContentResponse>(response);
            return ok;
        }
    }
}
