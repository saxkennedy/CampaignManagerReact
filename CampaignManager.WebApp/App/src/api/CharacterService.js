import UserService from './UserService';

async function parseJson(res) {
    try { return await res.json(); } catch { return null; }
}

class CharacterService {
    // Any campaign member. Returns { canManage, myUserId, characters: [...] }.
    async listCharacters(campaignId) {
        const res = await UserService.authFetch(`/api/campaigns/${campaignId}/characters`, { method: 'GET' });
        const data = await parseJson(res);
        if (!res.ok) throw new Error(data?.error || `Failed to load characters (${res.status})`);
        return data;
    }

    // DM only. payload: { name, notes?, userId? }
    async createCharacter(campaignId, payload) {
        const res = await UserService.authFetch(`/api/campaigns/${campaignId}/characters`, {
            method: 'POST',
            body: JSON.stringify(payload),
        });
        const data = await parseJson(res);
        if (!res.ok) throw new Error(data?.error || `Failed to create character (${res.status})`);
        return data;
    }

    // DM: any field; owner: name/notes. payload: { name?, notes?, isActive?, sortOrder?, userId?, unassignOwner? }
    async updateCharacter(characterId, payload) {
        const res = await UserService.authFetch(`/api/characters/${characterId}`, {
            method: 'PUT',
            body: JSON.stringify(payload),
        });
        const data = await parseJson(res);
        if (!res.ok) throw new Error(data?.error || `Failed to update character (${res.status})`);
        return data;
    }

    // DM only.
    async deleteCharacter(characterId) {
        const res = await UserService.authFetch(`/api/characters/${characterId}`, { method: 'DELETE' });
        const data = await parseJson(res);
        if (!res.ok) throw new Error(data?.error || `Failed to delete character (${res.status})`);
        return data;
    }
}

export default new CharacterService();
