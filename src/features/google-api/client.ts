import { requestUrl, RequestUrlParam } from 'obsidian';

export class AuthToken {
    constructor(private _refreshToken: string, private _accessToken: string) {}
    get refreshToken() {
        return this._refreshToken;
    }
    get accessToken() {
        return this._accessToken;
    }
}

type TokenResponse = {
    access_token: string;
    token_type: string;
    refresh_token: string;
    // e.g. 2022-11-11T00:48:20.051366+09:00
    expiry: string;
};

export class GoogleAuthClient {
    private static readonly BASE = 'https://obsidian-reminder-server.vercel.app/api/auth/google';
    public static readonly SCOPE_TASKS = 'https://www.googleapis.com/auth/tasks';
    public static readonly SCOPE_CALENDAR = 'https://www.googleapis.com/auth/calendar.events';
    private token?: AuthToken;

    public generateAuthURL(...scopes: Array<string>): string {
        const encodedScopes = window.encodeURIComponent(scopes.join(' '));
        return `${GoogleAuthClient.BASE}/auth?scope=${encodedScopes}`;
    }

    public async generateToken(code: string): Promise<AuthToken> {
        const rawResponse = await requestUrl({
            url: `${GoogleAuthClient.BASE}/token?code=${window.encodeURIComponent(code)}`,
            method: 'GET',
        });
        const tokenResponse = rawResponse.json as TokenResponse;
        this.token = new AuthToken(tokenResponse.refresh_token, tokenResponse.access_token);
        return this.token;
    }

    public async refreshAccessToken(refreshToken: string): Promise<void> {
        const rawResponse = await requestUrl({
            url: `${GoogleAuthClient.BASE}/refresh?refresh_token=${window.encodeURIComponent(refreshToken)}`,
            method: 'GET',
        });
        const tokenResponse = rawResponse.json as TokenResponse;
        this.token = new AuthToken(tokenResponse.refresh_token, tokenResponse.access_token);
    }

    public isReady(): boolean {
        return this.token != null;
    }

    public reset() {
        this.token = undefined;
    }

    public async request(req: RequestUrlParam): Promise<any> {
        if (req.headers == null) {
            req.headers = {};
        }
        if (this.token == null) {
            throw 'token not set';
        }
        req.headers['Authorization'] = `Bearer ${this.token.accessToken}`;
        let rawResponse = await requestUrl(req);
        if (rawResponse.status == 401) {
            await this.refreshAccessToken(this.token.refreshToken);
            if (this.token == null) {
                throw 'unable to refresh access token';
            }
            req.headers['Authorization'] = `Bearer ${this.token.accessToken}`;
            rawResponse = await requestUrl(req);
        }
        if (rawResponse.status / 100 == 4 || rawResponse.status / 100 == 5) {
            throw `failed to call api: ${rawResponse.text}`;
        }
        if (rawResponse.status == 204) {
            return null;
        }
        const contentType = rawResponse.headers['content-type'];
        if (contentType != null && contentType.startsWith('application/json')) {
            return rawResponse.json;
        }
        return rawResponse.text;
    }

    public async get(url: string, queryParameters: Map<string, string> = new Map()): Promise<any> {
        const q = Array.from(queryParameters.entries())
            .map((e) => `${window.encodeURIComponent(e[0])}=${window.encodeURIComponent(e[1])}`)
            .join('&');
        let u = url;
        if (q.length > 0) {
            u = `${u}?${q}`;
        }
        return this.request({
            url: u,
            method: 'GET',
        });
    }

    public async post(url: string, body: any): Promise<any> {
        return this.request({
            url,
            headers: {
                'Content-Type': 'application/json',
            },
            method: 'POST',
            body: JSON.stringify(body),
        });
    }

    public async delete(url: string): Promise<any> {
        return this.request({
            url,
            method: 'DELETE',
        });
    }
}
