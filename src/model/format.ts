import moment from "moment";
import { ReadOnlyReference } from "./ref";
import { Reminder } from "./reminder";
import { DateTime, DATE_TIME_FORMATTER } from "./time";

export class ReminderEdit {
    public checked: boolean | null = null;
    public time: DateTime | null = null;
    public rawTime: string | null = null;
}

export interface ReminderFormat {
    /**
     * Parse given line if possible.
     * 
     * @param file file path
     * @param lineIndex line index
     * @param line line to parse
     * @returns parsed reminder.  If the line cannot be parsed, returns null
     */
    parse(file: string, lineIndex: number, line: string): Reminder | null
    /**
     * Modify the given line if possible.
     * 
     * @param line line to parse
     * @param edit defines how to edit
     * @returns modified line.  If the line cannot be parsed, returns null
     */
    modify(line: string, edit: ReminderEdit): string | null;
}

class DefaultReminderLine {
    constructor(
        public prefix: string,
        public check: string,
        public title1: string,
        public time: string,
        public title2: string
    ) { }

    toLine(): string {
        return `${this.prefix}- [${this.check}] ${this.title1}(@${this.time})${this.title2}`;
    }
}

export class DefaultReminderFormat implements ReminderFormat {

    public static readonly instance = new DefaultReminderFormat();

    private static reminderRegexp = /^(?<prefix>\s*)\- \[(?<check>.)\]\s(?<title1>.*?)\(@(?<time>.+?)\)(?<title2>.*)$/;

    private constructor() { }

    parse(file: string, lineIndex: number, line: string): Reminder | null {
        const parsed = this.parseReminderLine(line);
        if (parsed === null) {
            return null;
        }
        if (parsed.check === "x") {
            return null;
        }

        const title = `${parsed.title1.trim()} ${parsed.title2.trim()}`.trim();
        const parsedTime = DATE_TIME_FORMATTER.parse(parsed.time);
        if (parsedTime !== null) {
            return new Reminder(file, title, parsedTime, lineIndex);
        }
        return null;
    }

    modify(line: string, edit: ReminderEdit): string {
        const r = this.parseReminderLine(line);
        if (r === null) {
            return null;
        }
        if (edit.checked !== null) {
            r.check = edit.checked ? "x" : " ";
        }
        if (edit.rawTime !== null) {
            r.time = edit.rawTime;
        } else if (edit.time !== null) {
            r.time = DATE_TIME_FORMATTER.toString(edit.time);
        }
        return r.toLine();
    }

    private parseReminderLine(line: string): DefaultReminderLine | null {
        const result = DefaultReminderFormat.reminderRegexp.exec(line);
        if (result === null) {
            return null;
        }
        const prefix = result.groups.prefix;
        const check = result.groups.check;
        const title1 = result.groups.title1;
        const time = result.groups.time;
        const title2 = result.groups.title2;
        return new DefaultReminderLine(prefix, check, title1, time, title2);
    }

}

class TasksPluginReminderLine {
    constructor(
        public prefix: string,
        public check: string,
        public title: string,
        public dueDate: string | null,
        public doneDate: string | null,
        public recurrence: string | null) { }

    toLine(): string {
        let line = `${this.prefix}- [${this.check}] ${this.title}`
        if (this.recurrence !== null) {
            line = `${line} 🔁${this.recurrence}`
        }
        if (this.dueDate !== null) {
            line = `${line} 📅${this.dueDate}`;
        }
        if (this.doneDate !== null) {
            line = `${line} ✅${this.doneDate}`;
        }
        return line;
    };
}

export class TasksPluginFormat implements ReminderFormat {

    public static readonly instance = new TasksPluginFormat();

    private static readonly dateFormat = "YYYY-MM-DD";
    private static readonly reminderRegexp = /^(?<prefix>\s*)\- \[(?<check>.)\]\s(?<content>.*)$/;
    private static readonly dueDateRegexp = /[📅📆🗓] ?(\d{4}-\d{2}-\d{2})/u;
    public static readonly doneDateRegex = /✅ ?(\d{4}-\d{2}-\d{2})/u;
    public static readonly recurrenceRegex = /🔁([a-zA-Z0-9, !]+)/u;

    private constructor() { };

    parse(file: string, lineIndex: number, line: string): Reminder | null {
        const parsed = TasksPluginFormat.parseReminderLine(line);
        if (parsed === null) {
            return null;
        }
        if (parsed.check === "x") {
            return null;
        }
        if (parsed.dueDate === null) {
            return null;
        }
        const dueDate = moment(parsed.dueDate, TasksPluginFormat.dateFormat, true);

        if (!dueDate.isValid()) {
            return null;
        }
        return new Reminder(file, parsed.title, new DateTime(dueDate, false), lineIndex);
    }

    modify(line: string, edit: ReminderEdit): string | null {
        const parsed = TasksPluginFormat.parseReminderLine(line);
        if (parsed === null) {
            return null;
        }
        if (edit.checked !== null) {
            parsed.check = edit.checked ? "x" : " ";
            if (edit.checked) {
                // TODO add doneDate to default reminder and extract this code to caller-side.
                parsed.doneDate = moment().format(TasksPluginFormat.dateFormat);
            }
        }
        if (edit.rawTime !== null) {
            parsed.dueDate = edit.rawTime;
        } else if (edit.time !== null) {
            parsed.dueDate = edit.time.format(TasksPluginFormat.dateFormat);
        }
        return parsed.toLine();
    }

    // visible for test
    static parseReminderLine(line: string): TasksPluginReminderLine | null {
        const baseResult = TasksPluginFormat.reminderRegexp.exec(line);
        if (baseResult === null) {
            return null;
        }
        const prefix = baseResult.groups.prefix;
        const check = baseResult.groups.check;
        let body = baseResult.groups.content;

        let dueDate: string = null;
        let doneDate: string = null;
        let recurrence: string = null;
        const dueDateMatch = body.match(TasksPluginFormat.dueDateRegexp);
        if (dueDateMatch !== null) {
            dueDate = dueDateMatch[1];
            body = body.replace(TasksPluginFormat.dueDateRegexp, '').trim();
        }
        const doneDateMatch = body.match(TasksPluginFormat.doneDateRegex);
        if (doneDateMatch !== null) {
            doneDate = doneDateMatch[1];
            body = body.replace(TasksPluginFormat.doneDateRegex, '').trim();
        }
        const recurrenceMatch = body.match(TasksPluginFormat.recurrenceRegex);
        if (recurrenceMatch !== null) {
            recurrence = recurrenceMatch[1].trim();
            body = body.replace(TasksPluginFormat.recurrenceRegex, '').trim();
        }
        const title = body;
        return new TasksPluginReminderLine(prefix, check, title, dueDate, doneDate, recurrence);
    }

}

class DynamicReminderFormat implements ReminderFormat {

    useDefaultReminderFormat: ReadOnlyReference<boolean>;
    useTasksPluginFormat: ReadOnlyReference<boolean>;

    parse(file: string, lineIndex: number, line: string): Reminder {
        if (this.useDefaultReminderFormat.value) {
            const parsed = DefaultReminderFormat.instance.parse(file, lineIndex, line);
            if (parsed !== null) {
                return parsed;
            }
        }
        if (this.useTasksPluginFormat.value) {
            const parsed = TasksPluginFormat.instance.parse(file, lineIndex, line);
            if (parsed !== null) {
                return parsed;
            }
        }
        return null;
    }
    modify(line: string, edit: ReminderEdit): string {
        if (this.useDefaultReminderFormat.value) {
            const modified = DefaultReminderFormat.instance.modify(line, edit);
            if (modified !== null) {
                return modified;
            }
        }
        if (this.useTasksPluginFormat.value) {
            const modified = TasksPluginFormat.instance.modify(line, edit);
            if (modified !== null) {
                return modified;
            }
        }
        return null;
    }
}

class CompositeReminderFormat implements ReminderFormat {
    private formats: Array<ReminderFormat> = [];

    resetFormat(formats: Array<ReminderFormat>) {
        this.formats = formats;
    }

    parse(file: string, lineIndex: number, line: string): Reminder | null {
        for (const formatter of this.formats) {
            const parsed = formatter.parse(file, lineIndex, line);
            if (parsed !== null) {
                return parsed;
            }
        }
        return null;
    }
    modify(line: string, edit: ReminderEdit): string | null {
        for (const formatter of this.formats) {
            const modified = formatter.modify(line, edit);
            if (modified !== null) {
                return modified;
            }
        }
        return null;
    }
}

const reminderFormat = new CompositeReminderFormat();
reminderFormat.resetFormat([DefaultReminderFormat.instance, TasksPluginFormat.instance]);
export const REMINDER_FORMAT = reminderFormat;