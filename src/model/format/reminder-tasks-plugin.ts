import type { MarkdownDocument, Todo } from "model/format/markdown";
import { DATE_TIME_FORMATTER, DateTime } from "model/time";
import moment from "moment";
import type { Moment } from "moment";
import { RRule } from "rrule";
import {
  ReminderFormatParameterKey,
  TodoBasedReminderFormat,
} from "./reminder-base";
import type { ReminderEdit, ReminderModel } from "./reminder-base";
import { Symbol, Tokens, splitBySymbol } from "./splitter";

function removeTags(text: string): string {
  // Obsidian tags may contain any letters and digits (including non-ASCII
  // characters), plus "-", "_" and "/" for nested tags.
  return text.replace(/#[\p{L}\p{N}\p{M}_/-]+/gu, "").trim();
}
export class TasksPluginReminderModel implements ReminderModel {
  private static readonly dateFormat = "YYYY-MM-DD";
  // The Tasks plugin itself only supports a date-only due date (📅 is
  // documented/parsed as `YYYY-MM-DD`). This plugin extends the due-date
  // symbol to optionally also carry a time (`YYYY-MM-DD HH:mm`), which is
  // why parsing tries this strict datetime format first and falls back to
  // the date-only format the Tasks plugin expects.
  private static readonly dueDateTimeFormat = "YYYY-MM-DD HH:mm";
  private static readonly symbolDueDate = Symbol.ofChars([..."📅📆🗓"]);
  private static readonly symbolDoneDate = Symbol.ofChar("✅");
  private static readonly symbolRecurrence = Symbol.ofChar("🔁");
  private static readonly symbolReminder = Symbol.ofChar("⏰");
  private static readonly symbolScheduled = Symbol.ofChar("⏳");
  private static readonly symbolStart = Symbol.ofChar("🛫");
  private static readonly allSymbols = [
    TasksPluginReminderModel.symbolDueDate,
    TasksPluginReminderModel.symbolDoneDate,
    TasksPluginReminderModel.symbolRecurrence,
    TasksPluginReminderModel.symbolReminder,
    TasksPluginReminderModel.symbolStart,
    TasksPluginReminderModel.symbolScheduled,
  ];

  public static parse(
    line: string,
    useCustomEmoji?: boolean,
    removeTags?: boolean,
    strictDateFormat?: boolean,
  ): TasksPluginReminderModel {
    return new TasksPluginReminderModel(
      useCustomEmoji ?? false,
      removeTags ?? false,
      strictDateFormat ?? true,
      new Tokens(splitBySymbol(line, this.allSymbols)),
    );
  }

  private constructor(
    private useCustomEmoji: boolean,
    private removeTags: boolean,
    private strictDateFormat: boolean,
    private tokens: Tokens,
  ) {}

  getTitle(): string | null {
    let title = this.tokens.getTokenText("", true);
    if (title != null && this.removeTags) {
      title = removeTags(title);
    }
    return title;
  }
  getTime(): DateTime | null {
    return this.getDate(this.getReminderSymbol());
  }
  setTime(time: DateTime, insertAt?: number): void {
    if (this.useCustomEmoji) {
      this.setDate(this.getReminderSymbol(), time, 1);
    } else {
      this.setDate(this.getReminderSymbol(), time, insertAt);
    }
  }
  getDueDate(): DateTime | null {
    return this.getDate(TasksPluginReminderModel.symbolDueDate);
  }
  setDueDate(time: DateTime): void {
    this.setDate(TasksPluginReminderModel.symbolDueDate, time);
  }
  setRawTime(rawTime: string): boolean {
    this.setDate(this.getReminderSymbol(), rawTime);
    return true;
  }
  private getReminderSymbol(): Symbol {
    if (this.useCustomEmoji) {
      return TasksPluginReminderModel.symbolReminder;
    } else {
      return TasksPluginReminderModel.symbolDueDate;
    }
  }

  getEndOfTimeTextIndex(): number {
    // get the end of the string index of due date or reminder date
    let timeSymbol = TasksPluginReminderModel.symbolDueDate;
    if (this.useCustomEmoji) {
      timeSymbol = TasksPluginReminderModel.symbolReminder;
    }
    const token = this.tokens.rangeOfSymbol(timeSymbol);
    if (token != null) {
      return token.end;
    }
    return this.toMarkdown().length;
  }

  toMarkdown(): string {
    return this.tokens.join();
  }

  setTitle(description: string) {
    this.tokens.setTokenText("", description, true, true);
  }

  getDoneDate(): DateTime | null {
    return this.getDate(TasksPluginReminderModel.symbolDoneDate);
  }

  setDoneDate(time: DateTime | string | undefined) {
    this.setDate(TasksPluginReminderModel.symbolDoneDate, time);
  }

  getRecurrence() {
    return this.tokens.getTokenText(
      TasksPluginReminderModel.symbolRecurrence,
      true,
    );
  }

  clone(): TasksPluginReminderModel {
    return TasksPluginReminderModel.parse(
      this.toMarkdown(),
      this.useCustomEmoji,
      this.removeTags,
      this.strictDateFormat,
    );
  }

  private getDate(symbol: Symbol): DateTime | null {
    const dateText = this.tokens.getTokenText(symbol, true);
    if (dateText === null) {
      return null;
    }
    if (symbol === TasksPluginReminderModel.symbolReminder) {
      return DATE_TIME_FORMATTER.parse(dateText);
    }
    if (symbol === TasksPluginReminderModel.symbolDueDate) {
      // Optional time-part extension: try the strict datetime format
      // first, and fall through to the date-only format below when it
      // doesn't match.
      const dateTime = moment(
        dateText,
        TasksPluginReminderModel.dueDateTimeFormat,
        true,
      );
      if (dateTime.isValid()) {
        return new DateTime(dateTime, true);
      }
    }
    const date = moment(
      dateText,
      TasksPluginReminderModel.dateFormat,
      this.strictDateFormat,
    );
    if (!date.isValid()) {
      return null;
    }
    return new DateTime(date, false);
  }

  private setDate(
    symbol: Symbol,
    time: DateTime | string | undefined,
    insertAt?: number,
  ) {
    if (time == null) {
      this.tokens.removeToken(symbol);
      return;
    }
    let timeStr: string;
    if (time instanceof DateTime) {
      if (symbol === TasksPluginReminderModel.symbolReminder) {
        timeStr = DATE_TIME_FORMATTER.toString(time);
      } else if (
        symbol === TasksPluginReminderModel.symbolDueDate &&
        time.hasTimePart
      ) {
        // Opt-in extension: only write the time suffix when the caller
        // explicitly gave us a time-bearing DateTime. Date-only due dates
        // keep writing the plain Tasks-plugin-compatible format.
        timeStr = time.format(TasksPluginReminderModel.dueDateTimeFormat);
      } else {
        timeStr = time.format(TasksPluginReminderModel.dateFormat);
      }
    } else {
      timeStr = time;
    }
    this.tokens.setTokenText(
      symbol,
      timeStr,
      true,
      true,
      this.shouldSplitBetweenSymbolAndText(),
      insertAt,
    );
  }

  private shouldSplitBetweenSymbolAndText(): boolean {
    let withSpace = 0;
    let noSpace = 0;
    this.tokens.forEachTokens((token) => {
      if (token.symbol === "") {
        return;
      }
      if (token.text.match(/^\s.*$/)) {
        withSpace += 1;
      } else {
        noSpace++;
      }
    });
    if (withSpace > noSpace) {
      return true;
    } else if (withSpace < noSpace) {
      return false;
    } else {
      return true;
    }
  }
}

export class TasksPluginFormat extends TodoBasedReminderFormat<TasksPluginReminderModel> {
  public static readonly instance = new TasksPluginFormat();

  parseReminder(todo: Todo): TasksPluginReminderModel | null {
    const parsed = TasksPluginReminderModel.parse(
      todo.body,
      this.useCustomEmoji(),
      this.removeTagsEnabled(),
      this.isStrictDateFormat(),
    );
    if (this.useCustomEmoji() && parsed.getDueDate() == null) {
      return null;
    }
    return parsed;
  }

  private removeTagsEnabled() {
    return this.config.getParameter(
      ReminderFormatParameterKey.removeTagsForTasksPlugin,
    );
  }

  private useCustomEmoji() {
    return this.config.getParameter(
      ReminderFormatParameterKey.useCustomEmojiForTasksPlugin,
    );
  }

  override modifyReminder(
    doc: MarkdownDocument,
    todo: Todo,
    parsed: TasksPluginReminderModel,
    edit: ReminderEdit,
  ): boolean {
    if (!super.modifyReminder(doc, todo, parsed, edit)) {
      return false;
    }
    if (edit.checked !== undefined) {
      if (edit.checked) {
        const recurrence = parsed.getRecurrence();
        if (recurrence !== null) {
          const nextReminderTodo = todo.clone()!;
          const nextReminder = parsed.clone();
          const dueDate = parsed.getDueDate();
          if (dueDate == null) {
            return false;
          }

          if (this.useCustomEmoji()) {
            const time = parsed.getTime();
            if (time == null) {
              return false;
            }
            const nextTime: Date | undefined = this.nextDate(
              recurrence,
              time.moment(),
            );
            const nextDueDate: Date | undefined = this.nextDate(
              recurrence,
              dueDate.moment(),
            );
            if (nextTime == null || nextDueDate == null) {
              return false;
            }
            nextReminder.setTime(new DateTime(moment(nextTime), true));
            nextReminder.setDueDate(
              new DateTime(moment(nextDueDate), dueDate.hasTimePart),
            );
          } else {
            const next: Date | undefined = this.nextDate(
              recurrence,
              dueDate.moment(),
            );
            if (next == null) {
              return false;
            }
            const nextDueDate = new DateTime(moment(next), dueDate.hasTimePart);
            nextReminder.setTime(nextDueDate);
          }
          nextReminderTodo.body = nextReminder.toMarkdown();
          nextReminderTodo.setChecked(false);
          doc.insertTodo(todo.lineIndex, nextReminderTodo);
        }
        parsed.setDoneDate(
          this.config.getParameter(ReminderFormatParameterKey.now),
        );
      } else {
        parsed.setDoneDate(undefined);
      }
    }
    return true;
  }

  private nextDate(recurrence: string, dtStart: Moment): Date | undefined {
    const rruleOptions = RRule.parseText(recurrence);
    if (!rruleOptions) {
      return undefined;
    }

    const today = this.config
      .getParameter(ReminderFormatParameterKey.now)
      .moment();
    today.set("hour", dtStart.get("hour"));
    today.set("minute", dtStart.get("minute"));
    today.set("second", dtStart.get("second"));
    today.set("millisecond", dtStart.get("millisecond"));
    if (today.isAfter(dtStart)) {
      dtStart = today;
    }

    // clone dtStart because dtStart will be modified by utc() call.
    const base = dtStart.clone();

    // process rrule
    rruleOptions.dtstart = dtStart.utc(true).toDate();
    const rrule = new RRule(rruleOptions);
    const rdate = rrule.after(dtStart.toDate(), false);
    if (rdate == null) {
      return undefined;
    }

    // apply rrule to `base`
    const diff = rdate.getTime() - rruleOptions.dtstart.getTime();
    base.add(diff, "millisecond");
    return base.toDate();
  }

  newReminder(
    title: string,
    time: DateTime,
    insertAt?: number,
  ): TasksPluginReminderModel {
    const parsed = TasksPluginReminderModel.parse(
      title,
      this.useCustomEmoji(),
      this.removeTagsEnabled(),
      this.isStrictDateFormat(),
    );
    parsed.setTime(time, insertAt);
    if (this.useCustomEmoji() && parsed.getDueDate() == null) {
      parsed.setDueDate(time);
    }
    parsed.setTitle(title);
    return parsed;
  }
}
