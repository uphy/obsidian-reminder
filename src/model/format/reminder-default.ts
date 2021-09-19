import { DateTime, DATE_TIME_FORMATTER } from "model/time";
import type { Todo } from "./markdown";
import { ReminderFormatParameterKey, ReminderModel, TodoBasedReminderFormat } from "./reminder-base";

class DefaultReminderModel implements ReminderModel {

    public static readonly regexp = /^(?<title1>.*?)\(@(?<time>.+?)\)(?<title2>.*)$/;

    static parse(line: string, linkDatesToDailyNotes?: boolean): DefaultReminderModel | null {
        if (linkDatesToDailyNotes == null) {
            linkDatesToDailyNotes = false;
        }
        const result = DefaultReminderModel.regexp.exec(line);
        if (result == null) {
            return null;
        }
        const title1 = result.groups!['title1']!;
        let time = result.groups!['time'];
        if (time == null) {
            return null;
        }
        const title2 = result.groups!['title2']!;
        if (linkDatesToDailyNotes) {
            time = time.replace("[[", "");
            time = time.replace("]]", "");
        }
        return new DefaultReminderModel(linkDatesToDailyNotes, title1, time, title2);
    }

    constructor(
        private linkDatesToDailyNotes: boolean,
        public title1: string,
        public time: string,
        public title2: string
    ) { }

    getTitle(): string {
        return `${this.title1.trim()} ${this.title2.trim()}`.trim();
    }
    getTime(): DateTime | null {
        return DATE_TIME_FORMATTER.parse(this.time);
    }
    setTime(time: DateTime): void {
        this.time = DATE_TIME_FORMATTER.toString(time);
    }
    setRawTime(rawTime: string): boolean {
        this.time = rawTime;
        return true;
    }
    toMarkdown(): string {
        let result = `${this.title1}(@${this.time})${this.title2}`;
        if (!this.linkDatesToDailyNotes) {
            return result;
        }

        let time = DATE_TIME_FORMATTER.parse(this.time);
        if (!time) {
            return result;
        }

        const date = DATE_TIME_FORMATTER.toString(time.clone(false));
        return result.replace(date, `[[${date}]]`);
    }
}

export class DefaultReminderFormat extends TodoBasedReminderFormat<DefaultReminderModel> {

    public static readonly instance = new DefaultReminderFormat();

    parseReminder(todo: Todo): DefaultReminderModel | null {
        return DefaultReminderModel.parse(todo.body, this.linkDatesToDailyNotes());
    }

    newReminder(title: string, time: DateTime): DefaultReminderModel {
        return new DefaultReminderModel(this.linkDatesToDailyNotes(), title, time.toString(), "");
    }

    private linkDatesToDailyNotes() {
        return this.config.getParameter(ReminderFormatParameterKey.linkDatesToDailyNotes);
    }
}

