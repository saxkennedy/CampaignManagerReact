using CampaignManager.Services.Models;
using Data.Models;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace CampaignManager.Services.Services.Abstractions
{
    public interface ICampaignAdminService
    {
        public Task<AdminCampaignContentResponse> GetCampaignContent(Guid campaignId);
        public Task<string> AddContent(AddContentRequest createUser);
    }
}
