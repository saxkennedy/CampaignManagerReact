using System;

namespace CampaignManager.Services.Models
{
    public class CreateCampaignResponse
    {
        public Guid CampaignId { get; set; }
        public Guid CreatorPersonaId { get; set; }  // hierarchy 1 persona
        public Guid JoinPersonaId { get; set; }     // campaign join persona
    }
}
