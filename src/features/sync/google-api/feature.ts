import { AbstractPluginDataHolder, PluginDataHolder } from 'data';
import { Notice } from 'obsidian';
import { GoogleAuthClient } from './client';
import { Feature, Plugin } from '../../feature';

type GoogleApiData = {
    refreshToken: string;
};

class GoogleApiDataHolder extends AbstractPluginDataHolder<GoogleApiData> {
    constructor() {
        super('googleApi', {
            refreshToken: '',
        });
    }

    set refreshToken(t: string) {
        this.data.refreshToken = t;
        this.notifyChanged();
    }

    get refreshToken() {
        return this.data.refreshToken;
    }
}

export interface GoogleApiListener {
    onConnect(): Promise<void>;
    onDisconnect(): Promise<void>;
    onAuthCallback(state: string, scopes: Array<string>): Promise<void>;
}

export class GoogleApiFeature extends Feature {
    googleApiData = new GoogleApiDataHolder();
    googleAuthClient = new GoogleAuthClient();
    listeners: Array<GoogleApiListener> = [];

    /**
     * Add connection listener.
     * This method should be called from Feature's constructor or Feature#init() method.
     */
    addListener(l: GoogleApiListener) {
        this.listeners.push(l);
    }

    private async notifyOnConnect() {
        for (const listener of this.listeners) {
            await listener.onConnect();
        }
    }
    private async notifyOnDisconnect() {
        for (const listener of this.listeners) {
            await listener.onDisconnect();
        }
    }
    private async notifyOnAuthCallback(state: string, scopes: Array<string>) {
        for (const listener of this.listeners) {
            await listener.onAuthCallback(state, scopes);
        }
    }

    public openAuthUrl(state: string, ...scopes: Array<string>) {
        const authUrl = this.googleAuthClient.generateAuthURL(state, ...scopes);
        window.open(authUrl);
    }

    override async init(plugin: Plugin): Promise<void> {
        plugin.pluginDataIO.register(this.googleApiData);

        plugin.registerObsidianProtocolHandler('reminder-google-auth-callback', (req) => {
            const code = req['code'] as string;
            const state = req['state'] as string;
            (async () => {
                const token = await this.googleAuthClient.generateToken(code);
                this.googleApiData.refreshToken = token.refreshToken;
                await this.notifyOnAuthCallback(state, this.googleAuthClient.scopes);
                new Notice('Successfully logged in to Google');
            })().catch((e) => {
                new Notice(e);
            });
        });
        plugin.addCommand({
            id: 'stop-google-synchronization',
            name: 'Stop all Google synchronization',
            checkCallback: (checking: boolean): boolean | void => {
                if (checking) {
                    return this.googleAuthClient.isReady();
                }
                this.googleApiData.refreshToken = '';
                this.googleAuthClient.reset();
                this.notifyOnDisconnect().catch((e) => new Notice(e));
            },
        });
    }

    override async onload(plugin: Plugin): Promise<void> {
        if (this.googleApiData.refreshToken.length > 0) {
            await this.googleAuthClient.refreshAccessToken(this.googleApiData.refreshToken);
            await this.notifyOnConnect();
        }
    }
}
