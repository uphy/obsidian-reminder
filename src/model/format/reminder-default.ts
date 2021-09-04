import { ReminderFormat, ReminderEdit } from "./reminder-base";
import { Reminder } from "model/reminder";
import { DATE_TIME_FORMATTER } from "model/time";

class DefaultReminderLine {
    constructor(
        public title1: string,
        public time: string,
        public title2: string
    ) { }

    toLine(): string {
        return `${this.title1}(@${this.time})${this.title2}`;
    }
}

export class RegexpReminderFormat implements ReminderFormat {

    public static readonly instance = new RegexpReminderFormat(/^(?<title1>.*?)\(@(?<time>.+?)\)(?<title2>.*)$/);
    public static readonly kanban = new RegexpReminderFormat(/^(?<title1>.*?)@\{(?<time>.+?)\}(?<title2>.*)$/);

    private constructor(private readonly reminderRegexp: RegExp) { }

    parse(file: string, lineIndex: number, line: string): Reminder | null {
        const parsed = this.parseReminderLine(line);
        if (parsed === null) {
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
        if (edit.rawTime !== undefined) {
            r.time = edit.rawTime;
        } else if (edit.time !== undefined) {
            r.time = DATE_TIME_FORMATTER.toString(edit.time);
        }
        return r.toLine();
    }

    private parseReminderLine(line: string): DefaultReminderLine | null {
        const result = this.reminderRegexp.exec(line);
        if (result === null) {
            return null;
        }
        const title1 = result.groups.title1;
        const time = result.groups.time;
        const title2 = result.groups.title2;
        return new DefaultReminderLine(title1, time, title2);
    }

}

