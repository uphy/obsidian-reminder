import { ReminderFormat, ReminderEdit } from "./reminder-base";
import { Reminder } from "model/reminder";
import { DateTime, DATE_TIME_FORMATTER } from "model/time";
import moment from "moment";

class KanbanReminderLine {
    constructor(
        public title1: string,
        public title2: string,
        public date: string,
        public time?: string,
    ) { }

    getDateTime(): DateTime | null {
        if (this.time) {
            const m = moment(`${this.date} ${this.time}`, "YYYY-MM-DD HH:mm", true);
            if (!m.isValid()) {
                return null;
            }
            return new DateTime(m, true);
        } else {
            const m = moment(this.date, "YYYY-MM-DD", true);
            if (!m.isValid()) {
                return null;
            }
            return new DateTime(m, false);
        }
    }

    toLine(): string {
        let dateTime: string = `@{${this.date}}`;
        if (this.time) {
            dateTime += ` @@{${this.time}}`;
        }

        return `${this.title1}${dateTime}${this.title2}`;
    }
}

export class KanbanReminderFormat implements ReminderFormat {

    public static readonly instance = new KanbanReminderFormat();
    public static readonly regexp = /^(?<title1>.*?)@\{(?<date>.+?)\}( @@\{(?<time>.+?)\})?(?<title2>.*)$/;

    private constructor() { }

    parse(file: string, lineIndex: number, line: string): Reminder | null {
        const parsed = KanbanReminderFormat.parse(line);
        if (parsed === null) {
            return null;
        }

        const title = `${parsed.title1.trim()} ${parsed.title2.trim()}`.trim();
        const parsedTime = parsed.getDateTime();
        if (parsedTime !== null) {
            return new Reminder(file, title, parsedTime, lineIndex);
        }
        return null;
    }

    modify(line: string, edit: ReminderEdit): string {
        const r = KanbanReminderFormat.parse(line);
        if (r === null) {
            return null;
        }
        // rawTime is not supported
        if (edit.time !== undefined) {
            if (edit.time.hasTimePart) {
                const date = edit.time.format("YYYY-MM-DD");
                const time = edit.time.format("HH:mm");
                r.time = time;
                r.date = date;
            } else {
                const date = edit.time.format("YYYY-MM-DD");
                r.time = undefined;
                r.date = date;
            }
        }
        return r.toLine();
    }

    static parse(line: string): KanbanReminderLine | null {
        const result = KanbanReminderFormat.regexp.exec(line);
        if (result === null) {
            return null;
        }
        const title1 = result.groups.title1;
        const date = result.groups.date;
        const title2 = result.groups.title2;
        const time = result.groups.time;
        return new KanbanReminderLine(title1, title2, date, time);
    }

}

