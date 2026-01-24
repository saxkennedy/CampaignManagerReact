class UserService {
    static TOKEN_KEY = "authToken";
    static LAST_ACTIVITY_KEY = "lastActivityUtcMs";
    static IDLE_LIMIT_MS = 4 * 60 * 60 * 1000; // 4 hours

    setToken(token) {
        localStorage.setItem(UserService.TOKEN_KEY, token);
        this.updateLastActivity();
    }

    clearToken() {
        localStorage.removeItem(UserService.TOKEN_KEY);
        localStorage.removeItem(UserService.LAST_ACTIVITY_KEY);
    }

    getToken() {
        return localStorage.getItem(UserService.TOKEN_KEY);
    }

    updateLastActivity() {
        localStorage.setItem(UserService.LAST_ACTIVITY_KEY, String(Date.now()));
    }

    isIdleExpired() {
        const raw = localStorage.getItem(UserService.LAST_ACTIVITY_KEY);
        if (!raw) return false; // if never set, don't immediately expire
        const last = Number(raw);
        if (!Number.isFinite(last)) return false;
        return (Date.now() - last) > UserService.IDLE_LIMIT_MS;
    }

    async authFetch(url, options = {}) {
        const token = this.getToken();

        // If token exists but user has been idle too long, clear token and block.
        if (token && this.isIdleExpired()) {
            this.clearToken();
            throw new Error("Session expired due to inactivity.");
        }

        const headers = { ...(options.headers || {}) };

        // Only set JSON content-type when we have a body and caller didn't override it
        if (options.body && !headers["Content-Type"]) {
            headers["Content-Type"] = "application/json";
        }

        if (token) {
            headers["Authorization"] = `Bearer ${token}`;
        }

        const res = await fetch(url, { ...options, headers });

        // Update activity on successful calls
        if (res.ok) {
            this.updateLastActivity();
        }

        // If unauthorized, clear token so the app will force login
        if (res.status === 401) {
            this.clearToken();
        }

        return res;
    }

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

        const result = await res.json().catch(() => null);
        if (!res.ok) throw new Error(result?.message || "CreateUser failed");
        return result;
    }

    async GetUser(email, password) {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const result = await response.json().catch(() => null);

        if (!response.ok) {
            throw new Error(result?.message || "Login failed");
        }

        // Store token for refresh/deep link
        const token = result?.token ?? result?.Token;
        if (token) this.setToken(token);

        return result;
    }

    async Me() {
        const res = await this.authFetch('/api/me', { method: "GET" });
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(data?.message || "Me failed");
        return data;
    }

    async ListJoinableCampaigns() {
        const res = await this.authFetch('/api/campaigns/joinable', { method: "GET" });
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(data?.message || "Failed to load joinable campaigns");
        return data;
    }

    async JoinCampaign(campaignId, password) {
        const res = await this.authFetch('/api/campaigns/join', {
            method: "POST",
            body: JSON.stringify({ campaignId, password })
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(data?.message || "Failed to join campaign");
        return data;
    }
}

export default new UserService();
