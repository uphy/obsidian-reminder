import { App, Modal, Setting } from 'obsidian';

export class InputModal extends Modal {
    private result: string = '';

    constructor(
        app: App,
        private message: string,
        private name: string,
        private onSubmit: (text: string) => void,
        private onCancel: () => void,
    ) {
        super(app);
    }

    override onOpen() {
        const { contentEl } = this;

        contentEl.createEl('h1', { text: this.message });

        new Setting(contentEl).setName(this.name).addText((text) =>
            text.onChange((value) => {
                this.result = value;
            }),
        );

        new Setting(contentEl).addButton((btn) =>
            btn
                .setButtonText('Submit')
                .setCta()
                .onClick(() => {
                    this.close();
                }),
        );
    }

    override onClose() {
        const { contentEl } = this;
        contentEl.empty();
        if (this.result.length > 0) {
            this.onSubmit(this.result);
        } else {
            this.onCancel();
        }
    }
}

export async function showInputDialog(message: string, name: string): Promise<string | null> {
    return new Promise((resolve) => {
        const modal = new InputModal(
            app,
            message,
            name,
            (text) => {
                resolve(text);
            },
            () => {
                resolve(null);
            },
        );
        modal.open();
    });
}
