import UserService from './UserService';

async function parseJson(res) {
    try { return await res.json(); } catch { return null; }
}

class BastionTurnService {
    // Any campaign member. Returns { canManage, myUserId, segments: [...] }.
    async listSegments(bastionId) {
        const res = await UserService.authFetch(`/api/bastions/${bastionId}/turn-segments`, { method: 'GET' });
        const data = await parseJson(res);
        if (!res.ok) throw new Error(data?.error || `Failed to load turn segments (${res.status})`);
        return data;
    }

    // DM only. payload: { title?, turnsGranted, daysGranted, longRestsPerDay, notes?, characterIds?, includeAllActive? }
    async createSegment(bastionId, payload) {
        const res = await UserService.authFetch(`/api/bastions/${bastionId}/turn-segments`, {
            method: 'POST',
            body: JSON.stringify(payload),
        });
        const data = await parseJson(res);
        if (!res.ok) throw new Error(data?.error || `Failed to issue segment (${res.status})`);
        return data;
    }

    // DM only; Open segments only.
    async updateSegment(segmentId, payload) {
        const res = await UserService.authFetch(`/api/turn-segments/${segmentId}`, {
            method: 'PUT',
            body: JSON.stringify(payload),
        });
        const data = await parseJson(res);
        if (!res.ok) throw new Error(data?.error || `Failed to update segment (${res.status})`);
        return data;
    }

    async concludeSegment(segmentId) {
        const res = await UserService.authFetch(`/api/turn-segments/${segmentId}/conclude`, { method: 'POST' });
        const data = await parseJson(res);
        if (!res.ok) throw new Error(data?.error || `Failed to conclude segment (${res.status})`);
        return data;
    }

    async reopenSegment(segmentId) {
        const res = await UserService.authFetch(`/api/turn-segments/${segmentId}/reopen`, { method: 'POST' });
        const data = await parseJson(res);
        if (!res.ok) throw new Error(data?.error || `Failed to reopen segment (${res.status})`);
        return data;
    }

    async deleteSegment(segmentId) {
        const res = await UserService.authFetch(`/api/turn-segments/${segmentId}`, { method: 'DELETE' });
        const data = await parseJson(res);
        if (!res.ok) throw new Error(data?.error || `Failed to delete segment (${res.status})`);
        return data;
    }
}

export default new BastionTurnService();
