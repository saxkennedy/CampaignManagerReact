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

class CampaignContentService {
    async getStructure(campaignId) {
        const res = await Api.fetch(`/api/campaigncontent/${campaignId}/structure`, {
            method: 'GET'
        });
        return res;
    }
}

export default new CampaignContentService();
