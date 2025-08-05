import { DateTime } from "model/time";
import moment from "moment";
import type { Todo } from "./markdown";
import { TodoBasedReminderFormat } from "./reminder-base";
import type { ReminderModel } from "./reminder-base";
import { escapeRegExpChars } from "./util";

type KanbanSettingType = {
  dateTrigger: string;
  dateFormat: string;
  timeTrigger: string;
  timeFormat: string;
  linkDateToDailyNote: boolean;
};

const kanbanSetting = new (class KanbanSetting {
  get dateTrigger() {
    return this.get("date-trigger", "@");
  }

  get dateFormat() {
    return this.get("date-format", "YYYY-MM-DD");
  }

  get timeTrigger() {
    return this.get("time-trigger", "@@");
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
    const plugin = plugins["obsidian-kanban"];
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
})();

type KanbanSplitResult = {
  title: string;
  time?: DateTime;
};

export class KanbanDateTimeFormat {
  static instance: KanbanDateTimeFormat = new KanbanDateTimeFormat(
    kanbanSetting,
  );

  private dateRegExp: RegExp;
  private timeRegExp: RegExp;

  constructor(private setting: KanbanSettingType) {
    let dateRegExpStr: string;
    if (setting.linkDateToDailyNote) {
      dateRegExpStr = `${escapeRegExpChars(this.setting.dateTrigger)}\\[\\[(?<date>.+?)\\]\\]`;
    } else {
      dateRegExpStr = `${escapeRegExpChars(this.setting.dateTrigger)}\\{(?<date>.+?)\\}`;
    }
    const timeRegExpStr = `${escapeRegExpChars(this.setting.timeTrigger)}\\{(?<time>.+?)\\}`;
    this.dateRegExp = new RegExp(dateRegExpStr);
    this.timeRegExp = new RegExp(timeRegExpStr);
  }

  format(time: DateTime): string {
    let datePart: string;

    if (this.setting.linkDateToDailyNote) {
      datePart = `${this.setting.dateTrigger}[[${time.format(this.setting.dateFormat)}]]`;
    } else {
      datePart = `${this.setting.dateTrigger}{${time.format(this.setting.dateFormat)}}`;
    }

    if (!time.hasTimePart) {
      return datePart;
    }

    return `${datePart} ${this.setting.timeTrigger}{${time.format(this.setting.timeFormat)}}`;
  }

  split(text: string, strictDateFormat?: boolean): KanbanSplitResult {
    const originalText = text;
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
    const title = text.trim();

    let parsedTime: DateTime;
    const strict = strictDateFormat ?? true;
    if (time) {
      parsedTime = new DateTime(
        moment(
          `${date} ${time}`,
          `${this.setting.dateFormat} ${this.setting.timeFormat}`,
          strict,
        ),
        true,
      );
    } else {
      parsedTime = new DateTime(
        moment(date, this.setting.dateFormat, strict),
        false,
      );
    }
    if (parsedTime.isValid()) {
      return { title, time: parsedTime };
    }
    return { title: originalText };
  }
}

export class KanbanReminderModel implements ReminderModel {
  static parse(
    line: string,
    strictDateFormat?: boolean,
  ): KanbanReminderModel | null {
    const splitted = KanbanDateTimeFormat.instance.split(
      line,
      strictDateFormat,
    );
    if (splitted.time == null) {
      return null;
    }
    return new KanbanReminderModel(splitted.title, splitted.time);
  }

  constructor(
    public title: string,
    public time: DateTime,
  ) {}

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

  computeSpan(): { start: number; end: number } {
    // toMarkdown() = `${title.trim()} ${dateSegment}[ optional " " + timeSegment ]`
    // Span should begin at the first character of the date segment, i.e., right after "title.trim() " (one space)
    const titleTrimmed = this.title.trim();
    const start = titleTrimmed.length + 1; // skip the single space after title

    // Construct date segment exactly as KanbanDateTimeFormat.format() would
    const dateSegment = kanbanSetting.linkDateToDailyNote
      ? `${kanbanSetting.dateTrigger}[[${this.time.format(kanbanSetting.dateFormat)}]]`
      : `${kanbanSetting.dateTrigger}{${this.time.format(kanbanSetting.dateFormat)}}`;

    let end = start + dateSegment.length;

    // If time part exists, format() appends: " " + timeTrigger{time}
    if (this.time.hasTimePart) {
      const timeSegment = ` ${kanbanSetting.timeTrigger}{${this.time.format(kanbanSetting.timeFormat)}}`;
      end += timeSegment.length;
    }

    return { start, end };
  }

  toMarkdown(): string {
    return `${this.title.trim()} ${KanbanDateTimeFormat.instance.format(this.time)}`;
  }
}

export class KanbanReminderFormat extends TodoBasedReminderFormat<KanbanReminderModel> {
  public static readonly instance = new KanbanReminderFormat();

  parseReminder(todo: Todo): KanbanReminderModel | null {
    return KanbanReminderModel.parse(todo.body, this.isStrictDateFormat());
  }

  newReminder(title: string, time: DateTime): KanbanReminderModel {
    const parsed = new KanbanReminderModel(title, time);
    parsed.setTime(time);
    return parsed;
  }
}
