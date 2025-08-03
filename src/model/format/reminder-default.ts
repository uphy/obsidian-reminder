import { DATE_TIME_FORMATTER, DateTime } from "model/time";
import type { Todo } from "./markdown";
import {
  ReminderFormatParameterKey,
  TodoBasedReminderFormat,
} from "./reminder-base";
import type { ReminderModel } from "./reminder-base";

class DefaultReminderModel implements ReminderModel {
  public static readonly regexp =
    /^(?<title1>.*?)\(@(?<time>.+?)\)(?<title2>.*)$/;

  static parse(
    line: string,
    linkDatesToDailyNotes?: boolean,
  ): DefaultReminderModel | null {
    if (linkDatesToDailyNotes == null) {
      linkDatesToDailyNotes = false;
    }
    const result = DefaultReminderModel.regexp.exec(line);
    if (result == null) {
      return null;
    }
    const title1 = result.groups!["title1"]!;
    let time = result.groups!["time"];
    if (time == null) {
      return null;
    }
    const title2 = result.groups!["title2"]!;
    if (linkDatesToDailyNotes) {
      time = time.replace("[[", "");
      time = time.replace("]]", "");
    }
    return new DefaultReminderModel(
      linkDatesToDailyNotes,
      title1,
      time,
      title2,
    );
  }

  private cachedRenderedTime: string;

  constructor(
    private linkDatesToDailyNotes: boolean,
    public title1: string,
    public time: string,
    public title2: string,
  ) {
    this.cachedRenderedTime = this.computeRenderedTime(this.time);
  }

  getTitle(): string {
    return `${this.title1.trim()} ${this.title2.trim()}`.trim();
  }
  getTime(): DateTime | null {
    return DATE_TIME_FORMATTER.parse(this.time);
  }
  setTime(time: DateTime): void {
    this.time = DATE_TIME_FORMATTER.toString(time);
    this.cachedRenderedTime = this.computeRenderedTime(this.time);
  }
  setRawTime(rawTime: string): boolean {
    this.time = rawTime;
    this.cachedRenderedTime = this.computeRenderedTime(this.time);
    return true;
  }
  getEndOfTimeTextIndex(): number {
    return this.toMarkdown().length - this.title2.length;
  }
  computeSpan(): { start: number; end: number } {
    // body = title1 + "(@" + cachedRenderedTime + ")" + title2
    const start = this.title1.length; // at "(@" start
    const end =
      start + 2 /* "(@" */ + this.cachedRenderedTime.length + 1; /* ")" */
    return { start, end };
  }
  toMarkdown(): string {
    return `${this.title1}(@${this.cachedRenderedTime})${this.title2}`;
  }

  private computeRenderedTime(raw: string): string {
    if (!this.linkDatesToDailyNotes) {
      return raw;
    }
    const parsed = DATE_TIME_FORMATTER.parse(raw);
    if (!parsed) {
      return raw;
    }
    const datePart = DATE_TIME_FORMATTER.toString(parsed.clone(false));
    return raw.replace(datePart, `[[${datePart}]]`);
  }
}

export class DefaultReminderFormat extends TodoBasedReminderFormat<DefaultReminderModel> {
  public static readonly instance = new DefaultReminderFormat();

  parseReminder(todo: Todo): DefaultReminderModel | null {
    return DefaultReminderModel.parse(todo.body, this.linkDatesToDailyNotes());
  }

  newReminder(
    title: string,
    time: DateTime,
    insertAt?: number,
  ): DefaultReminderModel {
    let title1: string;
    let title2: string;
    if (insertAt != null) {
      title1 = title.substring(0, insertAt);
      title2 = title.substring(insertAt);
    } else {
      title1 = title;
      title2 = "";
    }
    return new DefaultReminderModel(
      this.linkDatesToDailyNotes(),
      title1,
      time.toString(),
      title2,
    );
  }

  private linkDatesToDailyNotes() {
    return this.config.getParameter(
      ReminderFormatParameterKey.linkDatesToDailyNotes,
    );
  }
}
