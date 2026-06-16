import Api from './Api';
import UserService from './UserService';

async function parseJson(res) {
    try { return await res.json(); } catch { return null; }
}

class CampaignAdminService {
    // --- Tab 1: content (existing, anonymous endpoint via Api) ---
    async crudContent(campaignId, payload) {
        const res = await Api.fetch(`/api/campaignadmin/${campaignId}/content`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        return res;
    }

    // Campaign-assignable permission catalog (for the create flow + Tab 2).
    async getAssignablePermissions() {
        const res = await UserService.authFetch('/api/permissions/assignable', { method: 'GET' });
        const data = await parseJson(res);
        if (!res.ok) throw new Error(data?.error || `Failed to load permissions (${res.status})`);
        return data;
    }

    // --- Tab 2: persona management (authenticated) ---
    async getPersonas(campaignId) {
        const res = await UserService.authFetch(`/api/campaignadmin/${campaignId}/personas`, { method: 'GET' });
        const data = await parseJson(res);
        if (!res.ok) throw new Error(data?.error || `Failed to load personas (${res.status})`);
        return data;
    }

    async upsertPersona(campaignId, payload) {
        const res = await UserService.authFetch(`/api/campaignadmin/${campaignId}/personas`, {
            method: 'POST',
            body: JSON.stringify(payload),
        });
        const data = await parseJson(res);
        if (!res.ok) {
            const err = new Error(data?.error || `Failed to save persona (${res.status})`);
            err.status = res.status;
            // Present on a 409 rank collision: { hierarchy, personaName }
            err.rankConflict = data?.rankConflict || null;
            throw err;
        }
        return data;
    }

    // Returns { deleted:true } on success, or { deleted:false, error, blockingMembers:[...] } when blocked.
    async deletePersona(campaignId, personaId) {
        const res = await UserService.authFetch(`/api/campaignadmin/${campaignId}/personas/${personaId}`, {
            method: 'DELETE',
        });
        const data = await parseJson(res);
        if (res.status === 409) return data; // blocked by assigned members — a normal outcome
        if (!res.ok) {
            const err = new Error(data?.error || `Failed to delete persona (${res.status})`);
            err.status = res.status;
            throw err;
        }
        return data;
    }

    // --- Tab 3: members + reassignment (authenticated) ---
    async getMembers(campaignId) {
        const res = await UserService.authFetch(`/api/campaignadmin/${campaignId}/members`, { method: 'GET' });
        const data = await parseJson(res);
        if (!res.ok) throw new Error(data?.error || `Failed to load members (${res.status})`);
        return data;
    }

    async reassignMember(campaignId, payload) {
        const res = await UserService.authFetch(`/api/campaignadmin/${campaignId}/reassign`, {
            method: 'POST',
            body: JSON.stringify(payload),
        });
        const data = await parseJson(res);
        if (!res.ok) {
            const err = new Error(data?.error || `Failed to reassign member (${res.status})`);
            err.status = res.status;
            throw err;
        }
        return data;
    }
}

export default new CampaignAdminService();
