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
    onConnect(): void;
    onDisconnect(): void;
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

    private notifyOnConnect() {
        this.listeners.forEach((l) => l.onConnect());
    }
    private notifyOnDisconnect() {
        this.listeners.forEach((l) => l.onDisconnect());
    }

    override async init(plugin: Plugin): Promise<void> {
        plugin.pluginDataIO.register(this.googleApiData);

        plugin.addCommand({
            id: 'connect-to-google',
            name: 'Connect to Google',
            checkCallback: (checking: boolean): boolean | void => {
                if (checking) {
                    return !this.googleAuthClient.isReady();
                }
                const authUrl = this.googleAuthClient.generateAuthURL(
                    GoogleAuthClient.SCOPE_TASKS,
                    GoogleAuthClient.SCOPE_CALENDAR,
                );
                window.open(authUrl);
            },
        });
        plugin.registerObsidianProtocolHandler('reminder-google-auth-callback', (req) => {
            const code = req['code'] as string;
            (async () => {
                const token = await this.googleAuthClient.generateToken(code);
                this.googleApiData.refreshToken = token.refreshToken;
            })().catch((e) => {
                new Notice(e);
            });
        });
        plugin.addCommand({
            id: 'disconnect-from-google',
            name: 'Disconnect from Google',
            checkCallback: (checking: boolean): boolean | void => {
                if (checking) {
                    return this.googleAuthClient.isReady();
                }
                this.googleApiData.refreshToken = '';
                this.googleAuthClient.reset();
                this.notifyOnDisconnect();
            },
        });
    }

    override async onload(plugin: Plugin): Promise<void> {
        if (this.googleApiData.refreshToken.length > 0) {
            await this.googleAuthClient.refreshAccessToken(this.googleApiData.refreshToken);
            this.notifyOnConnect();
        }
    }
}
