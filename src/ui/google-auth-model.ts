import { App, Modal } from 'obsidian';
import GoogleAuth from './components/GoogleCalendarSetup.svelte';

export function showAuthorizationModal(
    app: App,
    authUrl: string,
    authorizeFunc: (code: string, calendarId: string) => Promise<void>,
) {
    const modal = new GoogleAuthModal(app, authUrl, authorizeFunc);
    modal.open();
}

class GoogleAuthModal extends Modal {
    canceled: boolean = true;

    constructor(
        app: App,
        private authUrl: string,
        private authorize: (code: string, calendarId: string) => Promise<void>,
    ) {
        super(app);
    }

    override onOpen() {
        const { contentEl } = this;
        new GoogleAuth({
            target: contentEl,
            props: {
                authUrl: this.authUrl,
                authorize: async (code: string, calendarId: string) => {
                    await this.authorize(code, calendarId);

                    // Successfully authorized.
                    this.close();
                    return;
                },
            },
        });
    }

    override onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
