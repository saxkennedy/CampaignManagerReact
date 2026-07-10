import UserService from './UserService';

async function parseJson(res) {
    try { return await res.json(); } catch { return null; }
}

class HirelingService {
    // Whole campaign roster (assigned + unassigned pool). Returns { canManage, hirelings }.
    async listCampaignHirelings(campaignId) {
        const res = await UserService.authFetch(`/api/campaigns/${campaignId}/hirelings`, { method: 'GET' });
        const data = await parseJson(res);
        if (!res.ok) throw new Error(data?.error || `Failed to load hirelings (${res.status})`);
        return data;
    }

    // Hirelings assigned to one room. Returns { canManage, hirelings }.
    async listRoomHirelings(roomId) {
        const res = await UserService.authFetch(`/api/bastion-rooms/${roomId}/hirelings`, { method: 'GET' });
        const data = await parseJson(res);
        if (!res.ok) throw new Error(data?.error || `Failed to load hirelings (${res.status})`);
        return data;
    }

    // Create in the campaign. payload: { name, role?, notes?, bastionRoomId? } (omit room ⇒ pool).
    async createHireling(campaignId, payload) {
        const res = await UserService.authFetch(`/api/campaigns/${campaignId}/hirelings`, {
            method: 'POST',
            body: JSON.stringify(payload),
        });
        const data = await parseJson(res);
        if (!res.ok) throw new Error(data?.error || `Failed to add hireling (${res.status})`);
        return data;
    }

    // payload: { name?, role?, notes?, isAbsent?, sortOrder?, bastionRoomId? (assign), unassign? }
    async updateHireling(hirelingId, payload) {
        const res = await UserService.authFetch(`/api/hirelings/${hirelingId}`, {
            method: 'PUT',
            body: JSON.stringify(payload),
        });
        const data = await parseJson(res);
        if (!res.ok) throw new Error(data?.error || `Failed to update hireling (${res.status})`);
        return data;
    }

    async deleteHireling(hirelingId) {
        const res = await UserService.authFetch(`/api/hirelings/${hirelingId}`, { method: 'DELETE' });
        const data = await parseJson(res);
        if (!res.ok) throw new Error(data?.error || `Failed to remove hireling (${res.status})`);
        return data;
    }
}

export default new HirelingService();
