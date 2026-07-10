import UserService from './UserService';

async function parseJson(res) {
    try { return await res.json(); } catch { return null; }
}

class BastionService {
    async listBastions(campaignId) {
        const res = await UserService.authFetch(`/api/campaigns/${campaignId}/bastions`, { method: 'GET' });
        const data = await parseJson(res);
        if (!res.ok) throw new Error(data?.error || `Failed to load bastions (${res.status})`);
        return data;
    }

    async createBastion(campaignId, payload) {
        const res = await UserService.authFetch(`/api/campaigns/${campaignId}/bastions`, {
            method: 'POST',
            body: JSON.stringify(payload),
        });
        const data = await parseJson(res);
        if (!res.ok) throw new Error(data?.error || `Failed to create bastion (${res.status})`);
        return data;
    }

    async getBastion(bastionId) {
        const res = await UserService.authFetch(`/api/bastions/${bastionId}`, { method: 'GET' });
        const data = await parseJson(res);
        if (!res.ok) throw new Error(data?.error || `Failed to load bastion (${res.status})`);
        return data;
    }

    async saveBastion(bastionId, payload) {
        const res = await UserService.authFetch(`/api/bastions/${bastionId}`, {
            method: 'PUT',
            body: JSON.stringify(payload),
        });
        const data = await parseJson(res);
        if (!res.ok) throw new Error(data?.error || `Failed to save bastion (${res.status})`);
        return data;
    }

    async deleteBastion(bastionId) {
        const res = await UserService.authFetch(`/api/bastions/${bastionId}`, { method: 'DELETE' });
        const data = await parseJson(res);
        if (!res.ok) throw new Error(data?.error || `Failed to delete bastion (${res.status})`);
        return data;
    }

    // ---- members / access ----
    async listMembers(bastionId) {
        const res = await UserService.authFetch(`/api/bastions/${bastionId}/members`, { method: 'GET' });
        const data = await parseJson(res);
        if (!res.ok) throw new Error(data?.error || `Failed to load members (${res.status})`);
        return data;
    }

    async upsertMember(bastionId, payload) {
        const res = await UserService.authFetch(`/api/bastions/${bastionId}/members`, {
            method: 'POST', body: JSON.stringify(payload),
        });
        const data = await parseJson(res);
        if (!res.ok) throw new Error(data?.error || `Failed to save member (${res.status})`);
        return data;
    }

    async removeMember(bastionId, memberUserId) {
        const res = await UserService.authFetch(`/api/bastions/${bastionId}/members/${memberUserId}`, { method: 'DELETE' });
        const data = await parseJson(res);
        if (!res.ok) throw new Error(data?.error || `Failed to remove member (${res.status})`);
        return data;
    }

    async setMemberCharacters(bastionId, memberUserId, characterIds) {
        const res = await UserService.authFetch(`/api/bastions/${bastionId}/members/${memberUserId}/characters`, {
            method: 'PUT', body: JSON.stringify({ characterIds }),
        });
        const data = await parseJson(res);
        if (!res.ok) throw new Error(data?.error || `Failed to assign characters (${res.status})`);
        return data;
    }

    // Characters assigned to this bastion (for segment issuance / spending pickers).
    async listBastionCharacters(bastionId) {
        const res = await UserService.authFetch(`/api/bastions/${bastionId}/characters`, { method: 'GET' });
        const data = await parseJson(res);
        if (!res.ok) throw new Error(data?.error || `Failed to load bastion characters (${res.status})`);
        return data;
    }
}

export default new BastionService();
