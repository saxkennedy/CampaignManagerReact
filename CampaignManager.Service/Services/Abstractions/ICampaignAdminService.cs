using CampaignManager.Services.Models;

namespace CampaignManager.Services.Services.Abstractions
{
    public interface ICampaignAdminService
    {
        Task<string> CRUDContent(CRUDContentRequest createUser);
        Task<CreateCampaignResponse> CreateCampaign(Guid creatorUserId, CampaignUpsertRequest request);

        // Campaign-assignable permission catalog (used by the create flow + Tab 2).
        Task<List<PermissionOption>> GetAssignablePermissions();

        // --- Tab 2: persona management ---
        Task<PersonaManagementResponse> GetPersonaManagement(Guid actorUserId, Guid campaignId);
        Task<PersonaDetail> UpsertPersona(Guid actorUserId, Guid campaignId, PersonaUpsertRequest request);
        Task<DeletePersonaResult> DeletePersona(Guid actorUserId, Guid campaignId, Guid personaId);

        // --- Tab 3: members + reassignment ---
        Task<CampaignMembersResponse> GetCampaignMembers(Guid actorUserId, Guid campaignId);
        Task ReassignMember(Guid actorUserId, Guid campaignId, ReassignMemberRequest request);
    }
}
