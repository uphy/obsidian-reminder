import { TodoBasedReminderFormat, ReminderModel } from "./reminder-base";
import { DateTime, DATE_TIME_FORMATTER } from "model/time";
import { Todo } from "./markdown";

class DefaultReminderModel implements ReminderModel {

    public static readonly regexp = /^(?<title1>.*?)\(@(?<time>.+?)\)(?<title2>.*)$/;

    static parse(line: string): DefaultReminderModel | null {
        const result = DefaultReminderModel.regexp.exec(line);
        if (result === null) {
            return null;
        }
        const title1 = result.groups.title1;
        const time = result.groups.time;
        const title2 = result.groups.title2;
        return new DefaultReminderModel(title1, time, title2);
    }

    constructor(
        public title1: string,
        public time: string,
        public title2: string
    ) { }

    getTitle(): string {
        return `${this.title1.trim()} ${this.title2.trim()}`;
    }
    getTime(): DateTime {
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
        return `${this.title1}(@${this.time})${this.title2}`;
    }
}

export class DefaultReminderFormat extends TodoBasedReminderFormat<DefaultReminderModel> {

    public static readonly instance = new DefaultReminderFormat();

    parseReminder(todo: Todo): DefaultReminderModel {
        return DefaultReminderModel.parse(todo.body);
    }

}

