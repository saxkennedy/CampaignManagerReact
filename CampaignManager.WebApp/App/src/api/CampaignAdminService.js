import Api from './Api';

// Small helper to normalize responses from Api.fetch (assumed to return a Response)
async function handleResponse(res) {
    // If your Api.fetch already returns JSON, delete this function and calls to it.
    if (!res) throw new Error('No response from server.');
    if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(text || `Request failed: ${res.status}`);
    }
    // Try JSON; fall back to text
    const contentType = res.headers?.get?.('content-type') || '';
    if (contentType.includes('application/json')) return res.json();
    const text = await res.text();
    try { return JSON.parse(text); } catch { return text; }
}

class CampaignAdminService {
    async getStructure(campaignId) {
        const res = await Api.fetch(`/api/campaignadmin/${campaignId}/structure`, {
            method: 'GET'
        });
        return res;
    }

    async addContent(campaignId, payload) {
        const res = await Api.fetch(`/api/campaignadmin/${campaignId}/content`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        return res;
    }

    // Optional future helpers:
    // async updateContent(campaignId, contentId, payload) { ... }
    // async deleteContent(campaignId, contentId) { ... }
}

export default new CampaignAdminService();
