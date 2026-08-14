// The creator persona sits at the top of the hierarchy (most privileged).
// Exactly one per campaign; always holds all permissions; only the creator holds it.
export const CREATOR_HIERARCHY = 0;

// Highest non-creator rank. Campaigns allow the creator (0) plus ranks 1..MAX_RANK.
export const MAX_RANK = 10;

// Permission display-name keys — must match dbo.Permissions.DisplayName values
// and the backend PermissionNames constants.
export const PERMISSIONS = {
    CanAddContent: 'CanAddContent',
    CanEditContent: 'CanEditContent',
    CanDeleteContent: 'CanDeleteContent',
    CanManagePersonas: 'CanManagePersonas',
    CanReassignUsers: 'CanReassignUsers',
};

const personasOf = (user) => user?.CampaignPersonas ?? user?.campaignPersonas ?? [];
const pf = (cp, pascal, camel) => cp?.[pascal] ?? cp?.[camel];

const sameCampaign = (cp, campaignId) => {
    if (!campaignId) return true;
    const cid = String(pf(cp, 'CampaignId', 'campaignId') ?? '').toLowerCase();
    return cid === String(campaignId).toLowerCase();
};

// Union of granted permission names across the user's personas in a campaign.
export function getCampaignPermissions(user, campaignId) {
    const set = new Set();
    for (const cp of personasOf(user)) {
        if (!sameCampaign(cp, campaignId)) continue;
        const perms = pf(cp, 'Permissions', 'permissions') ?? [];
        for (const p of perms) set.add(p);
    }
    return set;
}

// Shown on the dashboard when a link points somewhere the user can't reach.
export const NO_ACCESS_NOTICE = "You don't have access to that page.";

// Site administrators are treated as members of every campaign.
export function isSiteAdministrator(user) {
    return (
        user?.isAdmin === true ||
        (user?.SitePersonaName ?? user?.sitePersonaName) === 'Administrator'
    );
}

// True when the user holds any persona in the campaign (or is a site administrator).
// Used to decide whether a shared campaign link is reachable for this user.
export function isCampaignMember(user, campaignId) {
    if (!user) return false;
    if (isSiteAdministrator(user)) return true;
    if (!campaignId) return true;
    return personasOf(user).some((cp) => sameCampaign(cp, campaignId));
}

// Display name of a campaign, read off whichever persona the user holds in it.
// Empty when the user has no persona there — site administrators reach
// campaigns they were never given one for.
export function getCampaignName(user, campaignId) {
    if (!campaignId) return '';
    for (const cp of personasOf(user)) {
        if (!sameCampaign(cp, campaignId)) continue;
        const name = pf(cp, 'CampaignName', 'campaignName');
        if (name) return name;
    }
    return '';
}

// Most-privileged hierarchy the user holds in a campaign (lower = more privileged).
export function getUserHierarchyForCampaign(user, campaignId) {
    const levels = personasOf(user)
        .filter((cp) => sameCampaign(cp, campaignId))
        .map((cp) => Number(pf(cp, 'Hierarchy', 'hierarchy')))
        .filter((v) => Number.isFinite(v));
    return levels.length ? Math.min(...levels) : Infinity;
}

// Convenience flags for the three admin tabs.
export function getAdminCapabilities(user, campaignId) {
    const perms = getCampaignPermissions(user, campaignId);
    const canManageContent =
        perms.has(PERMISSIONS.CanAddContent) ||
        perms.has(PERMISSIONS.CanEditContent) ||
        perms.has(PERMISSIONS.CanDeleteContent);
    const canManagePersonas = perms.has(PERMISSIONS.CanManagePersonas);
    const canReassignUsers = perms.has(PERMISSIONS.CanReassignUsers);
    return {
        perms,
        canManageContent,
        canManagePersonas,
        canReassignUsers,
        canAdmin: canManageContent || canManagePersonas || canReassignUsers,
    };
}
