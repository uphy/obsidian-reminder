import { App, Modal } from 'obsidian';

export class InputModal extends Modal {
    private text: string = '';

    constructor(app: App, private onSubmit: (text: string) => void, private onCancel: () => void) {
        super(app);
    }

    override onOpen() {
        console.log('open');
        const input = document.createElement('input');
        input.type = 'text';
        input.onkeydown = (e) => {
            console.log(e.code);
            if (e.code === 'Enter') {
                this.text = input.value;
                this.close();
            }
        };
        this.contentEl.appendChild(input);
    }

    override onClose() {
        const { contentEl } = this;
        contentEl.empty();
        if (this.text.length > 0) {
            this.onSubmit(this.text);
        } else {
            this.onCancel();
        }
    }
}

export async function showInputDialog(app: App): Promise<string> {
    return new Promise((resolve, reject) => {
        const modal = new InputModal(
            app,
            (text) => {
                resolve(text);
            },
            () => {
                reject();
            },
        );
        modal.open();
    });
}
