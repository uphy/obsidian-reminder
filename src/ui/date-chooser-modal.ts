import type { Reminders } from "model/reminder";
import type { DateTime } from "model/time";
import { App, KeymapEventHandler, Modal, Modifier, Platform } from "obsidian";
import DateTimeChooser from "./components/DateTimeChooser.svelte";

class DateTimeChooserModal extends Modal {

    private selected?: DateTime;
    private handlers: KeymapEventHandler[] = [];

    constructor(
        app: App,
        private reminders: Reminders,
        private onSelect: (value: DateTime) => void,
        private onCancel: () => void
    ) {
        super(app);
    }

    override onOpen() {
        let targetElement: HTMLElement;
        if (Platform.isDesktop) {
            this.modalEl.style.minWidth = "0px";
            this.modalEl.style.minHeight = "0px";
            this.modalEl.style.width = "auto";
            targetElement = this.contentEl;
        } else {
            targetElement = this.containerEl;
        }

        const chooser = new DateTimeChooser({
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            target: targetElement,
            props: {
                onClick: (time: DateTime) => {
                    this.select(time);
                },
                reminders: this.reminders,
                undefined
            },
        });
        this.registerKeymap(["Ctrl"], "P", () => chooser["moveUp"]());
        this.registerKeymap([], "ArrowUp", () => chooser["moveUp"]());
        this.registerKeymap(["Ctrl"], "N", () => chooser["moveDown"]());
        this.registerKeymap([], "ArrowDown", () => chooser["moveDown"]());
        this.registerKeymap(["Ctrl"], "B", () => chooser["moveLeft"]());
        this.registerKeymap([], "ArrowLeft", () => chooser["moveLeft"]());
        this.registerKeymap(["Ctrl"], "F", () => chooser["moveRight"]());
        this.registerKeymap([], "ArrowRight", () => chooser["moveRight"]());
        this.registerKeymap([], "Enter", () => this.select(chooser["selection"]()));
        this.registerKeymap([], "Escape", () => this.close());
    }

    private registerKeymap(modifier: Modifier[], key: string, action: () => void) {
        this.handlers.push(this.scope.register(modifier, key, (): boolean | void => {
            action();
            return false;
        }));
    }

    private select(time: DateTime) {
        this.selected = time;
        this.close();
    }

    override onClose() {
        this.handlers.forEach(handler => this.scope.unregister(handler));
        if (this.selected != null) {
            this.onSelect(this.selected);
        } else {
            this.onCancel();
        }
    }

}

export function showDateTimeChooserModal(app: App, reminders: Reminders): Promise<DateTime> {
    return new Promise((resolve, reject) => {
        const modal = new DateTimeChooserModal(app, reminders, resolve, reject);
        modal.open();
    });
}