using System;
using System.Collections.Generic;

namespace CampaignManager.Services.Models
{
    /// <summary>Payload for Tab 3: members plus the persona options to reassign them into.</summary>
    public class CampaignMembersResponse
    {
        public List<CampaignMemberDetail> Members { get; set; } = new();
        public List<PersonaOption> Personas { get; set; } = new();
        public int ActorLevel { get; set; }
    }

    public class PersonaOption
    {
        public Guid Id { get; set; }
        public string DisplayName { get; set; }
        public int Hierarchy { get; set; }
    }

    /// <summary>A campaign member with their current persona, for Tab 3 (reassignment).</summary>
    public class CampaignMemberDetail
    {
        public Guid UserId { get; set; }
        public string Email { get; set; }
        public string FirstName { get; set; }
        public string LastName { get; set; }
        public Guid CampaignPersonaId { get; set; }
        public string PersonaName { get; set; }
        public int Hierarchy { get; set; }
    }

    public class ReassignMemberRequest
    {
        public Guid UserId { get; set; }
        public Guid ToPersonaId { get; set; }
    }
}
