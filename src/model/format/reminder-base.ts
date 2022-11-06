import type { MarkdownDocument } from "model/format/markdown";
import type { ReadOnlyReference } from "model/ref";
import { Reminder } from "model/reminder";
import { DateTime } from "model/time";
import { Todo } from "./markdown";

export type ReminderEdit = {
    time?: DateTime,
    rawTime?: string,
    checked?: boolean
}
export type ReminderInsertion = {
    insertedLine: string,
    caretPosition: number,
}

export interface ReminderModel {
    getTitle(): string | null;
    getTime(): DateTime | null;
    /** insertAt is a optional argument representing string index for indicating where to insert the time. */
    setTime(time: DateTime, insertAt?: number): void;
    /** return false when this reminder doesn't support raw time. */
    setRawTime(rawTime: string): boolean;
    toMarkdown(): string;
    /** 
     * get the string index at the end of time part. 
     * this is used for decision of caret position after inserting reminder.
     */
    getEndOfTimeTextIndex(): number;
}

export class ReminderFormatParameterKey<T> {
    static readonly now = new ReminderFormatParameterKey<DateTime>("now", DateTime.now());
    static readonly useCustomEmojiForTasksPlugin = new ReminderFormatParameterKey<boolean>("useCustomEmojiForTasksPlugin", false);
    static readonly removeTagsForTasksPlugin = new ReminderFormatParameterKey<boolean>("removeTagsForTasksPlugin", false);
    static readonly linkDatesToDailyNotes = new ReminderFormatParameterKey<boolean>("linkDatesToDailyNotes", false);
    static readonly strictDateFormat = new ReminderFormatParameterKey<boolean>("strictDateFormat", false);
    constructor(public readonly key: string, public readonly defaultValue: T) {
    }
}

type ReminderFormatParameterSource<T> = () => T;

export class ReminderFormatConfig {
    private parameters: Map<string, ReminderFormatParameterSource<any>> = new Map();
    constructor() { }

    /**
     * Set parameter for this format.
     * 
     * @param key parameter key
     */
    setParameter<T>(key: ReminderFormatParameterKey<T>, value: ReadOnlyReference<T>): void {
        this.parameters.set(key.key, () => value.value);
    }

    /**
     * Set parameter for this format.
     * 
     * @param key parameter key
     */
    setParameterFunc<T>(key: ReminderFormatParameterKey<T>, f: ReminderFormatParameterSource<T>): void {
        this.parameters.set(key.key, f);
    }

    setParameterValue<T>(key: ReminderFormatParameterKey<T>, value: T): void {
        this.parameters.set(key.key, () => value);
    }

    getParameter<T>(key: ReminderFormatParameterKey<T>): T {
        const value = this.parameters.get(key.key)
        if (value == null) {
            return key.defaultValue;
        }
        return value();
    }

}

export interface ReminderFormat {

    setConfig(config: ReminderFormatConfig): void;
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

    /**
     * Append a reminder information to the given line.
     * 
     * @param line line in editor
     * @param time time to append
     * @param insertAt position at `line` to insert reminder. (this is available only when the format supports insertion)
     */
    appendReminder(line: string, time: DateTime, insertAt?: number): ReminderInsertion | null;
}

export abstract class TodoBasedReminderFormat<E extends ReminderModel> implements ReminderFormat {

    protected config: ReminderFormatConfig = new ReminderFormatConfig();

    setConfig(config: ReminderFormatConfig): void {
        this.config = config;
    }

    parse(doc: MarkdownDocument): Reminder[] {
        return doc.getTodos()
            .map(todo => {
                const parsed = this.parseValidReminder(todo);
                if (parsed == null) {
                    return null;
                }
                const title = parsed.getTitle();
                if (title == null) {
                    return null;
                }
                const time = parsed.getTime();
                if (time == null) {
                    return null;
                }
                return new Reminder(doc.file, title, time, todo.lineIndex, todo.isChecked());
            })
            .filter((reminder): reminder is Reminder => reminder != null);
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

        if (!this.modifyReminder(doc, todo, parsed, edit)) {
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

    modifyReminder(doc: MarkdownDocument, todo: Todo, parsed: E, edit: ReminderEdit): boolean {
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

    appendReminder(line: string, time: DateTime, insertAt?: number): ReminderInsertion | null {
        const todo = Todo.parse(0, line);
        if (todo == null) {
            return null;
        }
        let parsed = this.parseReminder(todo);
        const todoHeaderLength = todo.getHeaderLength();
        if (insertAt != null) {
            // insert at position of TODO body part
            insertAt -= todoHeaderLength;
        }
        if (parsed != null) {
            parsed.setTime(time, insertAt);
        } else {
            parsed = this.newReminder(todo.body, time, insertAt);
            parsed.setTime(time);
        }
        todo.body = parsed.toMarkdown();
        return {
            insertedLine: todo.toMarkdown(),
            caretPosition: todoHeaderLength + parsed.getEndOfTimeTextIndex(),
        };
    }

    abstract parseReminder(todo: Todo): E | null;

    abstract newReminder(title: string, time: DateTime, insertAt?: number): E;

    protected isStrictDateFormat() {
        return this.config.getParameter(ReminderFormatParameterKey.strictDateFormat);
    }

}

export class CompositeReminderFormat implements ReminderFormat {

    private config?: ReminderFormatConfig;
    private formats: Array<ReminderFormat> = [];

    setConfig(config: ReminderFormatConfig): void {
        this.config = config;
        this.syncConfig();
    }

    parse(doc: MarkdownDocument): Reminder[] {
        const reminders: Array<Reminder> = []
        for (const format of this.formats) {
            const parsed = format.parse(doc);
            if (parsed == null) {
                continue;
            }
            reminders.push(...parsed);
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
        this.syncConfig();
    }

    private syncConfig() {
        if (this.config == null) {
            return;
        }
        this.formats.forEach(f => f.setConfig(this.config!));
    }

    appendReminder(line: string, time: DateTime): ReminderInsertion | null {
        if (this.formats[0] == null) {
            return null;
        }
        return this.formats[0].appendReminder(line, time);
    }

}
