namespace CampaignManager.Services.Authorization
{
    /// <summary>
    /// Stable string keys matching dbo.Permissions.DisplayName values.
    /// Authorization is evaluated against the CampaignPersonaPermissions table by
    /// matching these names; the Permissions.Id values are arbitrary and unused in code.
    /// Keep these in sync with the DisplayName column in dbo.Permissions.
    /// </summary>
    public static class PermissionNames
    {
        public const string CanAddContent = "CanAddContent";
        public const string CanEditContent = "CanEditContent";
        public const string CanDeleteContent = "CanDeleteContent";
        public const string CanManagePersonas = "CanManagePersonas";
        public const string CanReassignUsers = "CanReassignUsers";
    }
}
