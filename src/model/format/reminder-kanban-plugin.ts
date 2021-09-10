import { ReminderModel, TodoBasedReminderFormat } from "./reminder-base";
import { DateTime } from "model/time";
import moment from "moment";
import { Todo } from "./markdown";

export class KanbanReminderModel implements ReminderModel {

    private static readonly regexp = /^(?<title1>.*?)@\{(?<date>.+?)\}( @@\{(?<time>.+?)\})?(?<title2>.*)$/;

    static parse(line: string): KanbanReminderModel | null {
        const result = KanbanReminderModel.regexp.exec(line);
        if (result === null) {
            return null;
        }
        const title1 = result.groups.title1;
        const date = result.groups.date;
        const title2 = result.groups.title2;
        const time = result.groups.time;
        return new KanbanReminderModel(title1, title2, date, time);
    }

    constructor(
        public title1: string,
        public title2: string,
        public date: string,
        public time?: string,
    ) { }

    getTitle(): string {
        return `${this.title1.trim()} ${this.title2.trim()}`;
    }

    getTime(): DateTime | null {
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

    setTime(time: DateTime): void {
        if (time.hasTimePart) {
            this.time = time.format("HH:mm");
            this.date = time.format("YYYY-MM-DD");
        } else {
            this.time = undefined;
            this.date = time.format("YYYY-MM-DD");
        }
    }

    setRawTime(rawTime: string): boolean {
        return false;
    }

    toMarkdown(): string {
        let dateTime: string = `@{${this.date}}`;
        if (this.time) {
            dateTime += ` @@{${this.time}}`;
        }

        return `${this.title1}${dateTime}${this.title2}`;
    }

}

export class KanbanReminderFormat extends TodoBasedReminderFormat<KanbanReminderModel> {

    public static readonly instance = new KanbanReminderFormat();

    parseReminder(todo: Todo): KanbanReminderModel {
        return KanbanReminderModel.parse(todo.body);
    }

    newReminder(title: string, time: DateTime): KanbanReminderModel {
        const parsed = new KanbanReminderModel(title, "", time.format("YYYY-MM-DD"))
        parsed.setTime(time);
        return parsed;
    }
}

