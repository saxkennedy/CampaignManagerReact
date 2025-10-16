using CampaignManager.Services.Models;                 // CRUDContentRequest
using CampaignManager.Services.Services;
using CampaignManager.Services.Services.Abstractions; // ICampaignContentService
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Logging;
using System;
using System.IO;
using System.Net;



namespace api
{
    public class CampaignContentFunctions
    {
        private readonly ICampaignContentService CampaignContentService;
        private readonly ILogger<CampaignContentFunctions> _log;

        public CampaignContentFunctions(ICampaignContentService campaignContentService, ILogger<CampaignContentFunctions> log)
        {
            CampaignContentService = campaignContentService;
            _log = log;
        }

        [Function("Campaign_GetContent")]
        public async Task<HttpResponseData> GetCampaignContent(
            [HttpTrigger(AuthorizationLevel.Anonymous, "get",
                         Route = "campaigncontent/{campaignId}/structure")]
            HttpRequestData req,
            string campaignId)
        {
            _log.LogInformation("Get Admin Content Function triggered (isolated worker).");

            var response = await CampaignContentService.GetCampaignContent(Guid.Parse(campaignId));

            var ok = req.CreateResponse(HttpStatusCode.OK);
            await ok.WriteAsJsonAsync<CampaignContentResponse>(response);
            return ok;
        }
    }
}
