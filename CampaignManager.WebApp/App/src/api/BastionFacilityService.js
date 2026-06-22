import UserService from './UserService';

async function parseJson(res) {
    try { return await res.json(); } catch { return null; }
}

class BastionFacilityService {
    // Returns the full bastion-facility reference catalog (sorted by name).
    async listFacilities() {
        const res = await UserService.authFetch('/api/bastionfacilities', { method: 'GET' });
        const data = await parseJson(res);
        if (!res.ok) throw new Error(data?.error || `Failed to load bastion facilities (${res.status})`);
        return data;
    }
}

export default new BastionFacilityService();
