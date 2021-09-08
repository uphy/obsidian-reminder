import { Reminder } from "model/reminder"
import { DateTime } from "model/time"
import { MarkdownDocument } from "model/format/markdown";
import { Todo } from "./markdown";

export type ReminderEdit = {
    time?: DateTime,
    rawTime?: string,
    checked?: boolean
}

export interface ReminderModel {
    getTitle(): string;
    getTime(): DateTime | null;
    setTime(time: DateTime): void;
    /** return false when this reminder doesn't support raw time. */
    setRawTime(rawTime: string): boolean;
    toMarkdown(): string;
}

export interface ReminderFormat {
    /**
     * Parse given line if possible.
     */
    parse(doc: MarkdownDocument): Array<Reminder> | null
    /**
     * Modify the given line if possible.
     * 
     * @param doc Update target document.  In case of tasks plugin, we update Obsidian's file via tasks plugin command instead of this document.
     * @param reminder Reminder to edit.
     * @param edit defines how to edit
     * @returns true if modified
     */
    modify(doc: MarkdownDocument, reminder: Reminder, edit: ReminderEdit): Promise<boolean>;
}

export abstract class TodoBasedReminderFormat<E extends ReminderModel> implements ReminderFormat {
    parse(doc: MarkdownDocument): Reminder[] {
        return doc.getTodos()
            .map(todo => {
                if (todo.isChecked()) {
                    return null;
                }
                const parsed = this.parseValidReminder(todo);
                if (parsed === null) {
                    return null;
                }
                return new Reminder(doc.file, parsed.getTitle(), parsed.getTime(), todo.lineIndex);
            })
            .filter(reminder => reminder !== null);
    }

    async modify(doc: MarkdownDocument, reminder: Reminder, edit: ReminderEdit): Promise<boolean> {
        const todo = doc.getTodo(reminder.rowNumber);
        if (todo === null) {
            console.warn("Not a todo: reminder=%o", reminder);
            return false;
        }
        const parsed = this.parseValidReminder(todo);
        if (parsed === null) {
            return false;
        }

        if (!this.modifyReminder(todo, parsed, edit)) {
            return false;
        }
        todo.body = parsed.toMarkdown();
        return true;
    }

    private parseValidReminder(todo: Todo): E | null {
        const parsed = this.parseReminder(todo);
        if (parsed === null) {
            return null;
        }
        if (!this.isValidReminder(parsed)) {
            return null;
        }
        return parsed;
    }

    isValidReminder(reminder: E): boolean {
        return reminder.getTime() !== null;
    }

    abstract parseReminder(todo: Todo): E;

    modifyReminder(todo: Todo, parsed: E, edit: ReminderEdit): boolean {
        if (edit.rawTime !== undefined) {
            if (!parsed.setRawTime(edit.rawTime)) {
                console.warn("The reminder doesn't support raw time: parsed=%o", parsed);
                return false;
            }
        } else if (edit.time !== undefined) {
            parsed.setTime(edit.time);
        }
        if (edit.checked !== undefined) {
            todo.setChecked(edit.checked);
        }
        return true;
    }
}

export class CompositeReminderFormat implements ReminderFormat {

    private formats: Array<ReminderFormat> = [];

    parse(doc: MarkdownDocument): Reminder[] {
        const reminders: Array<Reminder> = []
        for (const format of this.formats) {
            reminders.push(...format.parse(doc));
        }
        return reminders;
    }

    async modify(doc: MarkdownDocument, reminder: Reminder, edit: ReminderEdit): Promise<boolean> {
        for (const format of this.formats) {
            const modified = await format.modify(doc, reminder, edit);
            if (modified) {
                return true;
            }
        }
        return false;
    }


    resetFormat(formats: Array<ReminderFormat>) {
        this.formats = formats;
    }

}
