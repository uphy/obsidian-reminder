import type { Todo } from "model/format/markdown";
import { DATE_TIME_FORMATTER, DateTime } from "model/time";
import moment from "moment";
import { ReminderFormatParameterKey } from "./reminder-base";
import { TasksLikeReminderFormat, removeTags } from "./reminder-tasks-like";
import type { TasksLikeReminderModel } from "./reminder-tasks-like";
import { Symbol, Tokens, splitBySymbol } from "./splitter";

export class TasksPluginReminderModel implements TasksLikeReminderModel {
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
    useDueDateFallback?: boolean,
  ): TasksPluginReminderModel {
    return new TasksPluginReminderModel(
      useCustomEmoji ?? false,
      removeTags ?? false,
      strictDateFormat ?? true,
      useDueDateFallback ?? false,
      new Tokens(splitBySymbol(line, this.allSymbols)),
    );
  }

  private constructor(
    private useCustomEmoji: boolean,
    private removeTags: boolean,
    private strictDateFormat: boolean,
    private useDueDateFallback: boolean,
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
    return this.getDate(this.resolveReminderSymbol());
  }
  setTime(time: DateTime, insertAt?: number): void {
    if (this.useCustomEmoji) {
      this.setDate(this.writeReminderSymbol(), time, 1);
    } else {
      this.setDate(this.writeReminderSymbol(), time, insertAt);
    }
  }
  getDueDate(): DateTime | null {
    return this.getDate(TasksPluginReminderModel.symbolDueDate);
  }
  setDueDate(time: DateTime): void {
    this.setDate(TasksPluginReminderModel.symbolDueDate, time);
  }
  setRawTime(rawTime: string): boolean {
    this.setDate(this.writeReminderSymbol(), rawTime);
    return true;
  }

  /**
   * Symbol used to read the reminder time. Unlike `writeReminderSymbol()`,
   * this may cascade through 📅/⏳/🛫 when the fallback setting is on, so
   * reads and writes intentionally use different symbol-resolution rules
   * (see design doc "Reminder-time resolution rule").
   */
  private resolveReminderSymbol(): Symbol {
    if (!this.useCustomEmoji) {
      return TasksPluginReminderModel.symbolDueDate;
    }
    if (!this.useDueDateFallback) {
      return TasksPluginReminderModel.symbolReminder;
    }
    const chain = [
      TasksPluginReminderModel.symbolReminder,
      TasksPluginReminderModel.symbolDueDate,
      TasksPluginReminderModel.symbolScheduled,
      TasksPluginReminderModel.symbolStart,
    ];
    for (const symbol of chain) {
      // Fallback is based on token presence, not parse validity: a
      // malformed higher-priority token still blocks fallback to a
      // lower-priority one.
      if (this.tokens.getToken(symbol) != null) {
        return symbol;
      }
    }
    return TasksPluginReminderModel.symbolReminder;
  }

  /**
   * Symbol used to write the reminder time (snooze). Always ⏰ in
   * custom-emoji mode, independent of the fallback setting, so snoozing
   * never clobbers 📅/⏳/🛫.
   */
  private writeReminderSymbol(): Symbol {
    if (this.useCustomEmoji) {
      return TasksPluginReminderModel.symbolReminder;
    } else {
      return TasksPluginReminderModel.symbolDueDate;
    }
  }

  getEndOfTimeTextIndex(): number {
    // get the end of the string index of due date or reminder date
    const token = this.tokens.rangeOfSymbol(this.resolveReminderSymbol());
    if (token != null) {
      return token.end;
    }
    return this.toMarkdown().length;
  }

  computeSpan(): { start: number; end: number } {
    const symbol = this.resolveReminderSymbol();
    const range = this.tokens.rangeOfSymbol(symbol);
    const token = this.tokens.getToken(symbol);
    if (range == null || token == null) {
      return { start: 0, end: 0 };
    }
    // `token.text` may carry a trailing separator space that actually
    // belongs before the *next* token (see `splitBySymbol`); trim it so the
    // span covers exactly the rendered time text (symbol + value) and
    // nothing past it. Note this is not simply `range.end - 1`: when the
    // reminder symbol is the last token in the line, there is no trailing
    // separator to trim at all.
    const trimmedTextLength = token.text.replace(/\s+$/, "").length;
    return {
      start: range.start,
      end: range.start + token.symbol.length + trimmedTextLength,
    };
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
      this.useDueDateFallback,
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

export class TasksPluginFormat extends TasksLikeReminderFormat<TasksPluginReminderModel> {
  public static readonly instance = new TasksPluginFormat();

  parseReminder(todo: Todo): TasksPluginReminderModel | null {
    const parsed = TasksPluginReminderModel.parse(
      todo.body,
      this.useCustomEmoji(),
      this.removeTagsEnabled(),
      this.isStrictDateFormat(),
      this.useDueDateFallback(),
    );
    if (this.useCustomEmoji()) {
      if (this.useDueDateFallback()) {
        if (parsed.getTime() == null) {
          return null;
        }
      } else {
        if (parsed.getDueDate() == null) {
          return null;
        }
      }
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

  private useDueDateFallback() {
    return this.config.getParameter(
      ReminderFormatParameterKey.useReminderTimeFallbackForTasksPlugin,
    );
  }

  protected override usesSeparateReminderDate(): boolean {
    return this.useCustomEmoji();
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
      this.useDueDateFallback(),
    );
    parsed.setTime(time, insertAt);
    if (this.useCustomEmoji() && parsed.getDueDate() == null) {
      parsed.setDueDate(time);
    }
    parsed.setTitle(title);
    return parsed;
  }
}
