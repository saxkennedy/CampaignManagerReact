class Api {
    async headers() {
        return {
            'Content-Type': 'application/json'
        }
    }

    async fetch(url, options) {
        options = { method: 'GET', ...options, headers: { ...await this.headers() } };
        return fetch(url, options);
    }

    async post(url, body) {
        const options = { method: 'POST', body: JSON.stringify(body), headers: { ...await this.headers() } };
        return await fetch(url, options);
    }
}

export default new Api();