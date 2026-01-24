const TOKEN_KEY = "authToken";
const LAST_ACTIVITY_KEY = "lastActivityUtc";
const FOUR_HOURS_MS = 4 * 60 * 60 * 1000;

function now() {
    return Date.now();
}

async function safeJson(res) {
    try {
        return await res.json();
    } catch {
        return null;
    }
}

// Normalize different backend shapes:
// - { user, token }
// - { User, Token }
// - direct user object
function extractUser(data) {
    if (!data) return null;
    return data.user ?? data.User ?? data;
}

function extractToken(data) {
    if (!data) return null;
    return data.token ?? data.Token ?? null;
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

        const token = this.getToken();
        const headers = { ...(options.headers || {}) };

        // IMPORTANT:
        // Azure Static Web Apps can strip/override the standard Authorization header
        // when proxying /api calls. Use a custom header that SWA will pass through.
        if (token) {
            headers["X-Ender-Auth"] = token;

            // Keep this for local dev / non-SWA environments (harmless if stripped in prod)
            headers["Authorization"] = `Bearer ${token}`;
        }

        if (options.body && !headers["Content-Type"]) headers["Content-Type"] = "application/json";

        const res = await fetch(url, { ...options, headers });

        if (res.ok) this.updateLastActivity();

        // Don't automatically clear token on every 401.
        // If SWA strips headers (or a transient issue occurs), clearing the token causes
        // the next calls to have no auth header, which matches the behavior you're seeing.
        if (res.status === 401) {
            // If the "me" endpoint says 401, token truly isn't valid anymore.
            if (String(url).includes("/api/me")) {
                this.clearToken();
            }
        }

        return res;
    }

    async CreateUser(user) {
        const res = await fetch("/api/createUser", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                Email: user.Email,
                Password: user.Password,
                FirstName: user.FirstName,
                LastName: user.LastName
            })
        });

        const data = await safeJson(res);
        if (!res.ok) throw new Error(data?.error || data?.message || "CreateUser failed");
        return extractUser(data) ?? data;
    }

    // Your Login component calls GetUser(email,password)
    async GetUser(email, password) {
        return this.Login(email, password);
    }

    async Login(email, password) {
        const res = await fetch("/api/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password })
        });

        const data = await safeJson(res);
        if (!res.ok) throw new Error(data?.error || data?.message || "Login failed");

        // Store token if returned
        const token = extractToken(data);
        if (token) this.setToken(token);

        // IMPORTANT: return the user object (so the rest of the app works)
        const user = extractUser(data);
        return user ?? data;
    }

    async Me() {
        const res = await this.authFetch("/api/me", { method: "GET" });
        const data = await safeJson(res);
        if (!res.ok) throw new Error(data?.error || data?.message || "Not authenticated");
        return extractUser(data) ?? data;
    }

    async ListJoinableCampaigns() {
        const res = await this.authFetch("/api/campaigns/joinable", { method: "GET" });
        const data = await safeJson(res);
        if (!res.ok) throw new Error(data?.error || data?.message || "Failed to load campaigns");
        return data;
    }

    async CreateCampaign(payload) {
        const res = await this.authFetch("/api/campaigns", {
            method: "POST",
            body: JSON.stringify(payload)
        });

        const data = await safeJson(res);

        if (!res.ok) {
            const msg = data?.error || data?.message || `Failed to create campaign (${res.status})`;
            const err = new Error(msg);
            err.status = res.status;
            throw err;
        }

        return data;
    }

    async JoinCampaign(campaignId, password) {
        const body = password ? { password } : {};

        const res = await this.authFetch(`/api/campaigns/${campaignId}/join`, {
            method: "POST",
            body: JSON.stringify(body)
        });

        const payload = await safeJson(res);

        if (res.status === 403) {
            const err = new Error(payload?.error || payload?.message || "Incorrect password.");
            err.status = 403;
            throw err;
        }

        if (!res.ok) {
            const err = new Error(payload?.error || payload?.message || "Failed to join campaign.");
            err.status = res.status;
            throw err;
        }

        if (!payload || payload.joined !== true) {
            const err = new Error(payload?.error || payload?.message || "Join was not completed.");
            err.status = 400;
            throw err;
        }

        return payload;
    }
}

export default new UserService();
