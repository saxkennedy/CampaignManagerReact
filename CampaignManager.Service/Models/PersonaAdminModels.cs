using System;
using System.Collections.Generic;

namespace CampaignManager.Services.Models
{
    /// <summary>Payload for Tab 2 (persona management): the campaign's personas plus the
    /// assignable-permission catalog and the actor's own authority context.</summary>
    public class PersonaManagementResponse
    {
        public List<PersonaDetail> Personas { get; set; } = new();
        public List<PermissionOption> AssignablePermissions { get; set; } = new();

        /// <summary>The acting user's most-privileged hierarchy in this campaign (lower = higher).</summary>
        public int ActorLevel { get; set; }

        /// <summary>The persona ids the acting user is assigned to (always editable by them).</summary>
        public List<Guid> ActorPersonaIds { get; set; } = new();
    }

    public class PersonaDetail
    {
        public Guid Id { get; set; }
        public string DisplayName { get; set; }
        public int Hierarchy { get; set; }
        public List<Guid> PermissionIds { get; set; } = new();
        public int MemberCount { get; set; }
        public List<MemberSummary> Members { get; set; } = new();
    }

    public class PermissionOption
    {
        public Guid Id { get; set; }
        public string DisplayName { get; set; }
    }

    /// <summary>Create (Id null) or edit (Id set) a campaign persona.</summary>
    public class PersonaUpsertRequest
    {
        public Guid? Id { get; set; }
        public string DisplayName { get; set; } = "";
        public int Hierarchy { get; set; }
        public List<Guid> PermissionIds { get; set; } = new();
    }

    public class DeletePersonaResult
    {
        public bool Deleted { get; set; }
        public string Error { get; set; }
        public List<MemberSummary> BlockingMembers { get; set; } = new();
        public int MemberCount { get; set; }
    }

    public class MemberSummary
    {
        public Guid UserId { get; set; }
        public string Email { get; set; }
        public string FirstName { get; set; }
        public string LastName { get; set; }
    }

    /// <summary>Thrown when a persona rank collides with an existing persona in the campaign,
    /// so the API can return a structured message naming the conflicting persona.</summary>
    public class RankConflictException : Exception
    {
        public int Hierarchy { get; }
        public string ExistingPersonaName { get; }

        public RankConflictException(int hierarchy, string existingPersonaName)
            : base($"Hierarchy {hierarchy} is already held by '{existingPersonaName}'. " +
                   "You must edit or remove that persona before assigning this rank.")
        {
            Hierarchy = hierarchy;
            ExistingPersonaName = existingPersonaName;
        }
    }
}
