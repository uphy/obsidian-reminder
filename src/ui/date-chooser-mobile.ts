import type { Reminder, Reminders } from "model/reminder";
import type { DateTime } from "model/time";
import { App, Modal } from "obsidian";
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
        new DateTimeChooser({
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            target: this.containerEl,
            props: {
                onClick: (time: DateTime) => {
                    this.selected = time;
                    this.close();
                },
                reminders: this.reminders,
                undefined
            },
        });
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