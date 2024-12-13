import { DateTime } from "model/time";
import moment from "moment";
import type { Todo } from "./markdown";
import { ReminderModel, TodoBasedReminderFormat } from "./reminder-base";
import { escapeRegExpChars } from "./util";

type DataviewSettingType = {
    dateTrigger: string,
    dateFormat: string,
    timeTrigger: string,
    timeFormat: string,
    linkDateToDailyNote: boolean
}

const dataviewSetting = new (class DataviewSetting {

    get dateTrigger() {
        return this.get("date-trigger", "due:: ");
    }

    get dateFormat() {
        return this.get("date-format", "YYYY-MM-DD");
    }

    get timeTrigger() {
        return this.get("time-trigger", "time:: ");
    }

    get timeFormat() {
        return this.get("time-format", "HH:mm");
    }

    get linkDateToDailyNote() {
        return this.get("link-date-to-daily-note", false);
    }

    private get<E>(key: string, defaultValue: E): E {
        if (!window) {
            return defaultValue;
        }
        const plugins = (window as any)?.app?.plugins?.plugins;
        if (!plugins) {
            return defaultValue;
        }
        const plugin = plugins["dataview"];
        if (!plugin) {
            return defaultValue;
        }
        const settings = plugin.settings;
        if (!settings) {
            return defaultValue;
        }
        const value = plugin.settings[key];
        if (value === null || value === undefined) {
            return defaultValue;
        }
        return value;
    }
});

type DataviewSplitResult = {
    title: string,
    time?: DateTime
}

export class DataviewDateTimeFormat {

    static instance: DataviewDateTimeFormat = new DataviewDateTimeFormat(dataviewSetting);

    private dateRegExp: RegExp;
    private timeRegExp: RegExp;

    constructor(private setting: DataviewSettingType) {
        let dateRegExpStr: string;
        if (setting.linkDateToDailyNote) {
            dateRegExpStr = `\\[${escapeRegExpChars(this.setting.dateTrigger)}\\[\\[(?<date>.+?)\\]\\]\\]`;
        } else {
            dateRegExpStr = `\\[${escapeRegExpChars(this.setting.dateTrigger)}(?<date>.+?)\\]`;
        }
 
        const timeRegExpStr = `\\[${escapeRegExpChars(this.setting.timeTrigger)}(?<time>.+?)\\]`;
        this.dateRegExp = new RegExp(dateRegExpStr);
        this.timeRegExp = new RegExp(timeRegExpStr);
    }

    format(time: DateTime): string {
        // NOTE: The Dataview task format doesn't currently support times, but we'll parse them anyway.
        let datePart: string;

        if (this.setting.linkDateToDailyNote) {
            datePart = `[${this.setting.dateTrigger}[[${time.format(this.setting.dateFormat)}]]]`;
        } else {
            datePart = `[${this.setting.dateTrigger}${time.format(this.setting.dateFormat)}]`;    
        }

        if (!time.hasTimePart) {
            return datePart;
        }

        return `${datePart} [${this.setting.timeTrigger}${time.format(this.setting.timeFormat)}]`
    }

    split(text: string, strictDateFormat?: boolean): DataviewSplitResult {
        const originalText = text;
        let title: string;
        let date: string;
        let time: string | undefined;

        const dateMatch = this.dateRegExp.exec(text);
        if (dateMatch) {
            date = dateMatch.groups!["date"]!;
            text = text.replace(this.dateRegExp, "");
        } else {
            return { title: originalText };
        }

        const timeMatch = this.timeRegExp.exec(text);
        if (timeMatch) {
            time = timeMatch.groups!["time"]!;
            text = text.replace(this.timeRegExp, "");
        }
        title = text.trim();

        let parsedTime: DateTime;
        const strict = strictDateFormat ?? true;
        if (time) {
            parsedTime = new DateTime(moment(`${date} ${time}`, `${this.setting.dateFormat} ${this.setting.timeFormat}`, strict), true)
        } else {
            parsedTime = new DateTime(moment(date, this.setting.dateFormat, strict), false)
        }
        if (parsedTime.isValid()) {
            return { title, time: parsedTime };
        }
        return { title: originalText };
    }

}

export class DataviewReminderModel implements ReminderModel {

    static parse(line: string, strictDateFormat?: boolean): DataviewReminderModel | null {
        const splitted = DataviewDateTimeFormat.instance.split(line, strictDateFormat);
        if (splitted.time == null) {
            return null;
        }
        return new DataviewReminderModel(splitted.title, splitted.time);
    }

    constructor(
        public title: string,
        public time: DateTime,
    ) { }

    getTitle(): string {
        return this.title.trim();
    }

    getTime(): DateTime | null {
        if (this.time) {
            return this.time;
        }
        return null;
    }

    setTime(time: DateTime): void {
        this.time = time;
    }

    setRawTime(): boolean {
        return false;
    }

    getEndOfTimeTextIndex(): number {
        return this.toMarkdown().length;
    }

    toMarkdown(): string {
        return `${this.title.trim()} ${DataviewDateTimeFormat.instance.format(this.time)}`;
    }

}

export class DataviewReminderFormat extends TodoBasedReminderFormat<DataviewReminderModel> {

    public static readonly instance = new DataviewReminderFormat();

    parseReminder(todo: Todo): DataviewReminderModel | null {
        return DataviewReminderModel.parse(todo.body, this.isStrictDateFormat());
    }

    newReminder(title: string, time: DateTime): DataviewReminderModel {
        const parsed = new DataviewReminderModel(title, time);
        parsed.setTime(time);
        return parsed;
    }
}
