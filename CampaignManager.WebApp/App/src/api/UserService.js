const TOKEN_KEY = "authToken";
const LAST_ACTIVITY_KEY = "lastActivityUtc";
const FOUR_HOURS_MS = 4 * 60 * 60 * 1000;

function now() {
    return Date.now();
}

class UserService {
    getToken() {
        return localStorage.getItem(TOKEN_KEY);
    }

    setToken(token) {
        localStorage.setItem(TOKEN_KEY, token);
        this.updateLastActivity();
    }

    clearToken() {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(LAST_ACTIVITY_KEY);
    }

    updateLastActivity() {
        localStorage.setItem(LAST_ACTIVITY_KEY, String(now()));
    }

    isIdleExpired() {
        const v = localStorage.getItem(LAST_ACTIVITY_KEY);
        if (!v) return false;
        const last = Number(v);
        return Number.isFinite(last) && (now() - last > FOUR_HOURS_MS);
    }

    async authFetch(url, options = {}) {
        if (this.isIdleExpired()) {
            this.clearToken();
            const err = new Error("Session expired due to inactivity");
            err.status = 401;
            throw err;
        }

        this.updateLastActivity();

        const token = this.getToken();
        const headers = { ...(options.headers || {}) };

        if (token) headers["Authorization"] = `Bearer ${token}`;
        if (options.body && !headers["Content-Type"]) headers["Content-Type"] = "application/json";

        const res = await fetch(url, { ...options, headers });

        if (res.status === 401) this.clearToken();

        return res;
    }

    // -------- Existing API calls --------
    async CreateUser(user) {
        const res = await fetch('/api/createUser', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                Email: user.Email,
                Password: user.Password,
                FirstName: user.FirstName,
                LastName: user.LastName
            })
        });

        if (!res.ok) throw new Error("CreateUser failed");
        return await res.json(); // { user, token }
    }

    async Login(email, password) {
        const res = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        if (!res.ok) throw new Error("Login failed");
        return await res.json(); // { user, token }
    }

    async Me() {
        const res = await this.authFetch('/api/me', { method: "GET" });
        if (!res.ok) throw new Error("Not authenticated");
        return await res.json();
    }

    // -------- Join campaign flow --------
    async ListJoinableCampaigns() {
        const res = await this.authFetch('/api/campaigns/joinable', { method: "GET" });
        if (!res.ok) throw new Error("Failed to load campaigns");
        return await res.json();
    }

    async CreateCampaign(payload) {
        const res = await this.authFetch("/api/campaigns", {
            method: "POST",
            body: JSON.stringify(payload)
        });

        let data = null;
        try { data = await res.json(); } catch { data = null; }

        if (!res.ok) {
            const msg = data?.error || `Failed to create campaign (${res.status})`;
            const err = new Error(msg);
            err.status = res.status;
            throw err;
        }

        return data; // { campaignId }
    }


    async JoinCampaign(campaignId, password) {
        const body = password ? { password } : {};

        const res = await this.authFetch(`/api/campaigns/${campaignId}/join`, {
            method: "POST",
            body: JSON.stringify(body)
        });

        // Try to parse body either way (useful even on 403/400)
        let payload = null;
        try {
            payload = await res.json();
        } catch {
            payload = null;
        }

        // Explicit forbidden -> wrong password
        if (res.status === 403) {
            const err = new Error(payload?.error || "Incorrect password.");
            err.status = 403;
            throw err;
        }

        // Any other non-OK
        if (!res.ok) {
            const err = new Error(payload?.error || "Failed to join campaign.");
            err.status = res.status;
            throw err;
        }

        // ? Guard: even if API returns 200, require joined === true
        if (!payload || payload.joined !== true) {
            const err = new Error(payload?.error || "Join was not completed.");
            err.status = 400;
            throw err;
        }

        return payload; // { joined: true, alreadyMember: bool }
    }
}

export default new UserService();
