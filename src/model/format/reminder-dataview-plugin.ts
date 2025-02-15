import { DateTime } from "model/time";
import moment from "moment";
import type { Todo } from "./markdown";
import { ReminderModel, TodoBasedReminderFormat } from "./reminder-base";
import { escapeRegExpChars } from "./util";

type DataviewSettingType = {
    dateTrigger: string,
    dateFormat: string
}

const dataviewSettings = new (class DataviewSettings {

    get dateTrigger() {
        return "due:: ";
    }

    get dateFormat() {
        return this.get("defaultDateFormat", "YYYY-MM-DD");
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

    static instance: DataviewDateTimeFormat = new DataviewDateTimeFormat(dataviewSettings);

    private dateRegExp: RegExp;

    constructor(private setting: DataviewSettingType) {
        this.dateRegExp = new RegExp(`\\[${escapeRegExpChars(this.setting.dateTrigger)}(?<date>.+?)\\]`);
    }

    format(time: DateTime): string {
        return `[${this.setting.dateTrigger}${time.format(this.setting.dateFormat)}]`;
    }

    split(text: string, strictDateFormat?: boolean): DataviewSplitResult {
        const originalText = text;
        let title: string;
        let date: string;

        const dateMatch = this.dateRegExp.exec(text);
        if (dateMatch) {
            date = dateMatch.groups!["date"]!;
            text = text.replace(this.dateRegExp, "");
        } else {
            return { title: originalText };
        }
        
        title = text.trim();

        let parsedTime: DateTime;
        const strict = strictDateFormat ?? true;
        parsedTime = new DateTime(moment(date, this.setting.dateFormat, strict), false)
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
