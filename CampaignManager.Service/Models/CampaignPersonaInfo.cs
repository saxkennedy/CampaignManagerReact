using System;
using System.Collections.Generic;

namespace CampaignManager.Services.Models
{
    /// <summary>
    /// A user's persona membership in a campaign, enriched with the persona's granted
    /// permission display names. Mirrors the GetCampaignPersona sproc result and adds
    /// Permissions (attached via a separate EF query, since the sproc is unchanged).
    /// Property names are PascalCase to match what the frontend already reads.
    /// </summary>
    public class CampaignPersonaInfo
    {
        public Guid CampaignPersonaId { get; set; }
        public string CampaignPersonaName { get; set; }
        public int Hierarchy { get; set; }
        public Guid CampaignId { get; set; }
        public string CampaignDescription { get; set; }
        public string CampaignName { get; set; }

        /// <summary>Granted permission display names (e.g. "CanAddContent").</summary>
        public List<string> Permissions { get; set; } = new();
    }
}
