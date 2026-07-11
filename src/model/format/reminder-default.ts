import { DATE_TIME_FORMATTER, DateTime } from "model/time";
import moment from "moment";
import type { MarkdownDocument, Todo } from "./markdown";
import { nextOccurrence } from "./recurrence";
import {
  ReminderFormatParameterKey,
  TodoBasedReminderFormat,
} from "./reminder-base";
import type { ReminderEdit, ReminderModel } from "./reminder-base";

export class DefaultReminderModel implements ReminderModel {
  public static readonly regexp =
    /^(?<title1>.*?)\(@(?<time>.+?)\)(?<title2>.*)$/;
  private static readonly recurrenceSymbol = "🔁";

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
    let recurrence: string | null = null;
    const symbolIndex = time.indexOf(DefaultReminderModel.recurrenceSymbol);
    if (symbolIndex >= 0) {
      const head = time.substring(0, symbolIndex).trim();
      const tail = time
        .substring(symbolIndex + DefaultReminderModel.recurrenceSymbol.length)
        .trim();
      // An empty tail (e.g. "(@2026-07-13 🔁)") is treated as non-recurring:
      // keep the whole group as `time` (exactly today's behavior) instead of
      // splitting it.
      if (tail !== "") {
        time = head;
        recurrence = tail;
      }
    }
    return new DefaultReminderModel(
      linkDatesToDailyNotes,
      title1,
      time,
      title2,
      recurrence,
    );
  }

  constructor(
    private linkDatesToDailyNotes: boolean,
    public title1: string,
    public time: string,
    public title2: string,
    public recurrence: string | null = null,
  ) {}

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
  getEndOfTimeTextIndex(): number {
    return this.toMarkdown().length - this.title2.length;
  }
  toMarkdown(): string {
    const timeText =
      this.recurrence !== null
        ? `${this.time} ${DefaultReminderModel.recurrenceSymbol}${this.recurrence}`
        : this.time;
    const result = `${this.title1}(@${timeText})${this.title2}`;
    if (!this.linkDatesToDailyNotes) {
      return result;
    }

    const time = DATE_TIME_FORMATTER.parse(this.time);
    if (!time) {
      return result;
    }

    const date = DATE_TIME_FORMATTER.toString(time.clone(false));
    return result.replace(date, `[[${date}]]`);
  }

  clone(): DefaultReminderModel {
    return DefaultReminderModel.parse(
      this.toMarkdown(),
      this.linkDatesToDailyNotes,
    )!;
  }
}

export class DefaultReminderFormat extends TodoBasedReminderFormat<DefaultReminderModel> {
  public static readonly instance = new DefaultReminderFormat();

  parseReminder(todo: Todo): DefaultReminderModel | null {
    return DefaultReminderModel.parse(todo.body, this.linkDatesToDailyNotes());
  }

  override modifyReminder(
    doc: MarkdownDocument,
    todo: Todo,
    parsed: DefaultReminderModel,
    edit: ReminderEdit,
  ): boolean {
    if (!super.modifyReminder(doc, todo, parsed, edit)) {
      return false;
    }
    if (edit.checked === true) {
      const recurrence = parsed.recurrence;
      if (recurrence !== null) {
        const currentTime = parsed.getTime();
        if (currentTime !== null) {
          const next = nextOccurrence(
            recurrence,
            currentTime.moment(),
            this.config.getParameter(ReminderFormatParameterKey.now),
          );
          if (next !== undefined) {
            const nextModel = parsed.clone();
            nextModel.setTime(
              new DateTime(moment(next), currentTime.hasTimePart),
            );
            const nextTodo = todo.clone()!;
            nextTodo.body = nextModel.toMarkdown();
            nextTodo.setChecked(false);
            doc.insertTodo(todo.lineIndex, nextTodo);
          }
          // nextOccurrence returning undefined means either the recurrence
          // text couldn't be parsed (already warned inside nextOccurrence)
          // or the series legitimately ended (an `until` rule whose date has
          // passed). Either way, complete normally without inserting a next
          // occurrence.
        }
      }
    }
    return true;
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
