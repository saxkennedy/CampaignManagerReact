using System;
using System.Collections.Generic;

namespace CampaignManager.Services.Models
{
    // Reusable for: Create Campaign now + Edit Campaign later
    public class CampaignUpsertRequest
    {
        public Guid? CampaignId { get; set; } // null for create, set for future edit
        public string Name { get; set; } = "";
        public string? Description { get; set; }

        // If set, campaign is protected; create UI will confirm twice
        public string? CampaignJoinPassword { get; set; }

        // Persona hierarchy to assign to NEW joiners (default 5 = Player)
        public int CampaignJoinPersonaHierarchy { get; set; } = 5;

        // Up to 10 personas. Must include exactly one with Hierarchy == 1.
        public List<CampaignPersonaUpsert> Personas { get; set; } = new();
    }

    public class CampaignPersonaUpsert
    {
        public Guid? Id { get; set; } // for future edit
        public string DisplayName { get; set; } = "";
        public int Hierarchy { get; set; }
    }
}
