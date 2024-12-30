import type { Reminders } from "model/reminder";
import { DateTime } from "model/time";
import { App, KeymapEventHandler, Modal, Modifier, Platform } from "obsidian";
import DateTimeChooser from "./components/DateTimeChooser.svelte";

class DateTimeChooserModal extends Modal {

    private selected?: DateTime;

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

        new DateTimeChooser({
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            target: targetElement,
            props: {
                onSelect: (time: moment.Moment) => {
                    this.select(new DateTime(time, true));
                },
                reminders: this.reminders,
                component: undefined
            },
        });
    }

    private select(time: DateTime) {
        this.selected = time;
        this.close();
    }

    override onClose() {
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