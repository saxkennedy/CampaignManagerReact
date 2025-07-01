class BackendApi {
    async headers() {
        return {
            'Content-Type': 'application/json'
        }
    }

    async fetch(url, options) {
        options = { method: 'GET', ...options, headers: { ...await this.headers() } };
        return fetch(url, options)
            .then(res => this.handleResponse(res, options.method));
    }

    async post(url, body) {
        const options = { method: 'POST', body: JSON.stringify(body), headers: { ...await this.headers() } };
        return await fetch(url, options)
            .then(res => this.handleResponse(res, options.method));
    }

    handleResponse(res, method) {
        if (res.status === 204) {
            return null
        }
        if (res.ok) {
            if (method === "GET" || method === "PATCH" || "POST") {
                return res.json();
            }
            return res;
        }
        return false;
    }
}

export default new BackendApi();