import UserService from './UserService';

async function parseJson(res) {
    try { return await res.json(); } catch { return null; }
}

class AdminService {
    // Fetches the 5etools bastion source data live (server-side) and upserts the catalog.
    // Returns { total, inserted, updated, unchanged, excludedCount, excluded }.
    async runBastionFacilitySeed() {
        const res = await UserService.authFetch('/api/siteadmin/seed/bastion-facilities', { method: 'POST' });
        const data = await parseJson(res);
        if (!res.ok) throw new Error(data?.error || `Update failed (${res.status})`);
        return data;
    }

    // Sends a test email (to `toEmail`, or the caller's own address if omitted).
    // Surfaces the raw SMTP error on failure so delivery problems are obvious.
    async sendTestEmail(toEmail) {
        const res = await UserService.authFetch('/api/siteadmin/test-email', {
            method: 'POST',
            body: JSON.stringify({ to: toEmail || undefined }),
        });
        const data = await parseJson(res);
        if (!res.ok) throw new Error(data?.error || `Send failed (${res.status})`);
        return data;
    }
}

export default new AdminService();
