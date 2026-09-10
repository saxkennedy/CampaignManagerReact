import UserService from './UserService';

async function parseJson(res) {
    try { return await res.json(); } catch { return null; }
}

class ActivityService {
    // Returns { canManage, myUserId, segment, activities: [...] }.
    async listActivities(segmentId) {
        const res = await UserService.authFetch(`/api/turn-segments/${segmentId}/activities`, { method: 'GET' });
        const data = await parseJson(res);
        if (!res.ok) throw new Error(data?.error || `Failed to load activities (${res.status})`);
        return data;
    }

    // payload: { characterId, bastionRoomId, actionKind, orderType?, title?, turnsCost, longRestsCost, startDay?, durationDays, notes?, hirelingIds? }
    async createActivity(segmentId, payload) {
        const res = await UserService.authFetch(`/api/turn-segments/${segmentId}/activities`, {
            method: 'POST',
            body: JSON.stringify(payload),
        });
        const data = await parseJson(res);
        if (!res.ok) throw new Error(data?.error || `Failed to add activity (${res.status})`);
        return data;
    }

    async updateActivity(activityId, payload) {
        const res = await UserService.authFetch(`/api/activities/${activityId}`, {
            method: 'PUT',
            body: JSON.stringify(payload),
        });
        const data = await parseJson(res);
        if (!res.ok) throw new Error(data?.error || `Failed to update activity (${res.status})`);
        return data;
    }

    async deleteActivity(activityId) {
        const res = await UserService.authFetch(`/api/activities/${activityId}`, { method: 'DELETE' });
        const data = await parseJson(res);
        if (!res.ok) throw new Error(data?.error || `Failed to remove activity (${res.status})`);
        return data;
    }

    // The caller's own activities across a bastion's segments, grouped by segment (open first).
    async listMine(bastionId) {
        const res = await UserService.authFetch(`/api/bastions/${bastionId}/my-activities`, { method: 'GET' });
        const data = await parseJson(res);
        if (!res.ok) throw new Error(data?.error || `Failed to load your actions (${res.status})`);
        return data;
    }

    // DM-only per-player readout for one segment:
    // { segment, players: [{ userId, playerName, totals, rooms, characters }] }.
    async getSegmentLog(segmentId) {
        const res = await UserService.authFetch(`/api/turn-segments/${segmentId}/log`, { method: 'GET' });
        const data = await parseJson(res);
        if (!res.ok) throw new Error(data?.error || `Failed to load the segment log (${res.status})`);
        return data;
    }
}

export default new ActivityService();
