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

  constructor(private setting: KanbanSettingType) {}

  // The Kanban plugin's settings are not available yet when this module is
  // loaded (`KanbanDateTimeFormat.instance` is created at import time) and
  // can change at any time afterwards, so the regular expressions must be
  // built from the current settings on every use.
  private get dateRegExp(): RegExp {
    if (this.setting.linkDateToDailyNote) {
      return new RegExp(
        `${escapeRegExpChars(this.setting.dateTrigger)}\\[\\[(?<date>.+?)\\]\\]`,
      );
    }
    return new RegExp(
      `${escapeRegExpChars(this.setting.dateTrigger)}\\{(?<date>.+?)\\}`,
    );
  }

  private get timeRegExp(): RegExp {
    return new RegExp(
      `${escapeRegExpChars(this.setting.timeTrigger)}\\{(?<time>.+?)\\}`,
    );
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

    const dateRegExp = this.dateRegExp;
    const dateMatch = dateRegExp.exec(text);
    if (dateMatch) {
      date = dateMatch.groups!["date"]!;
      text = text.replace(dateRegExp, "");
    } else {
      return { title: originalText };
    }

    const timeRegExp = this.timeRegExp;
    const timeMatch = timeRegExp.exec(text);
    if (timeMatch) {
      time = timeMatch.groups!["time"]!;
      text = text.replace(timeRegExp, "");
    }
    const title = text.trim();

    if (time) {
      // Kanban's time picker can emit either 24-hour times (`HH:mm`) or
      // 12-hour times (`h:mm A`/`hh:mm A`), and the format we assume here is
      // read live from the Kanban plugin's settings, which may be stale,
      // unreadable, or simply not match what the user actually typed.
      // Non-strict moment parsing silently discards trailing text it can't
      // match (e.g. it drops " PM" and quietly parses "2:30 PM" as 02:30
      // AM), turning a format mismatch into a *wrong* reminder time instead
      // of a missing one. So this path always parses strictly — ignoring
      // the global strictDateFormat setting, which still governs the
      // date-only path below — and tries a short list of candidate time
      // formats, accepting the first one that parses strictly.
      const candidateTimeFormats = [
        this.setting.timeFormat,
        ...["h:mm A", "hh:mm A", "HH:mm"].filter(
          (format) => format !== this.setting.timeFormat,
        ),
      ];
      for (const timeFormat of candidateTimeFormats) {
        const candidate = moment(
          `${date} ${time}`,
          `${this.setting.dateFormat} ${timeFormat}`,
          true,
        );
        if (candidate.isValid()) {
          return { title, time: new DateTime(candidate, true) };
        }
      }
      return { title: originalText };
    }

    const strict = strictDateFormat ?? true;
    const parsedTime = new DateTime(
      moment(date, this.setting.dateFormat, strict),
      false,
    );
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
    // toMarkdown() = `${title.trim()} ${formatted time}`, so the time text
    // starts right after "title.trim() " (one separating space) and runs to
    // the end of the markdown.
    const start = this.title.trim().length + 1;
    const end = start + KanbanDateTimeFormat.instance.format(this.time).length;
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
