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

    private static reminderRegexp = /^(?<prefix>\s*)\- \[(?<check>.)\]\s(?<title1>.*?)\(@(?<time>.+?)\)(?<title2>.*)$/;

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