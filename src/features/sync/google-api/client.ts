import { RequestUrlParam, requestUrl } from 'obsidian';

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

type TokenInfo = {
    issued_to: string;
    audience: string;
    // https://www.googleapis.com/auth/tasks https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar
    scope: string;
    expires_in: number;
    access_type: string;
};

export class GoogleAuthClient {
    private static readonly BASE = 'https://obsidian-reminder-server.vercel.app/api/auth/google';
    public static readonly SCOPE_TASKS = 'https://www.googleapis.com/auth/tasks';
    public static readonly SCOPE_CALENDAR_EVENTS = 'https://www.googleapis.com/auth/calendar.events';
    public static readonly SCOPE_CALENDAR = 'https://www.googleapis.com/auth/calendar';
    private _token?: AuthToken;
    private _scopes: Array<string> = [];

    public generateAuthURL(state: string, ...scopes: Array<string>): string {
        const encodedScopes = window.encodeURIComponent(scopes.join(' '));
        return `${GoogleAuthClient.BASE}/auth?scope=${encodedScopes}&state=${state}`;
    }

    public async generateToken(code: string): Promise<AuthToken> {
        const rawResponse = await requestUrl({
            url: `${GoogleAuthClient.BASE}/token?code=${window.encodeURIComponent(code)}`,
            method: 'GET',
        });
        const tokenResponse = rawResponse.json as TokenResponse;
        this._token = new AuthToken(tokenResponse.refresh_token, tokenResponse.access_token);
        this._scopes = await this.fetchScopes();
        return this._token;
    }

    private async fetchScopes(): Promise<Array<string>> {
        const accessToken = this._token?.accessToken;
        if (accessToken == null) {
            return [];
        }
        const rawResponse = await requestUrl({
            url: `https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=${window.encodeURIComponent(
                accessToken,
            )}`,
            method: 'GET',
        });
        const response = rawResponse.json as TokenInfo;
        return response.scope.split(' ');
    }

    public get scopes(): Array<string> {
        return this._scopes;
    }

    public async refreshAccessToken(refreshToken: string): Promise<void> {
        const rawResponse = await requestUrl({
            url: `${GoogleAuthClient.BASE}/refresh?refresh_token=${window.encodeURIComponent(refreshToken)}`,
            method: 'GET',
        });
        const tokenResponse = rawResponse.json as TokenResponse;
        this._token = new AuthToken(tokenResponse.refresh_token, tokenResponse.access_token);
        this._scopes = await this.fetchScopes();
    }

    public isReady(): boolean {
        return this._token != null;
    }

    public reset() {
        this._token = undefined;
        this._scopes = [];
    }

    public async request(req: RequestUrlParam): Promise<any> {
        if (req.headers == null) {
            req.headers = {};
        }
        if (this._token == null) {
            throw 'token not set';
        }
        req.headers['Authorization'] = `Bearer ${this._token.accessToken}`;
        let rawResponse = await requestUrl(req);
        if (rawResponse.status == 401) {
            await this.refreshAccessToken(this._token.refreshToken);
            if (this._token == null) {
                throw 'unable to refresh access token';
            }
            req.headers['Authorization'] = `Bearer ${this._token.accessToken}`;
            rawResponse = await requestUrl(req);
        }
        if (rawResponse.status / 100 == 4 || rawResponse.status / 100 == 5) {
            throw `failed to call api: ${rawResponse.text}`;
        }
        if (rawResponse.status == 204) {
            return null;
        }

        // 'headers' are Upper-Kebab case in Android but
        // lower-kebab case in mac.
        const lowerCaseHeaders = new Map<string, string>();
        Object.entries(rawResponse.headers).forEach(([k, v]) => {
            lowerCaseHeaders.set(k.toLocaleLowerCase(), v);
        });

        const contentType = lowerCaseHeaders.get('content-type');
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
