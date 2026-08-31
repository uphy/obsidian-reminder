import type { Todo } from "model/format/markdown";
import { DATE_TIME_FORMATTER, DateTime } from "model/time";
import moment from "moment";
import { ReminderFormatParameterKey } from "./reminder-base";
import { TasksLikeReminderFormat, removeTags } from "./reminder-tasks-like";
import type { TasksLikeReminderModel } from "./reminder-tasks-like";
import { Symbol, Tokens, splitBySymbol } from "./splitter";
import type { Token } from "./splitter";

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
    const symbol = this.resolveReminderSymbol();
    const token = this.tokens.rangeOfSymbol(symbol, this.carriesDate(symbol));
    if (token != null) {
      return token.end;
    }
    return this.toMarkdown().length;
  }

  computeSpan(): { start: number; end: number } {
    const symbol = this.resolveReminderSymbol();
    const prefer = this.carriesDate(symbol);
    const range = this.tokens.rangeOfSymbol(symbol, prefer);
    const token = this.tokens.getToken(symbol, prefer);
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

  /**
   * Field count of the longest date format any symbol here may carry. ⏰'s
   * formats are user-configurable via `DATE_TIME_FORMATTER`, so this cannot be
   * a constant: a cap below the format's own field count would silently
   * truncate the candidate ("Sep 8, 2021 10:00 AM" parsing as date-only).
   */
  private static maxLeadingFields(): number {
    const fieldCount = (format: string): number =>
      (format.match(/\S+/g) ?? []).length;
    return Math.max(
      fieldCount(TasksPluginReminderModel.dateFormat),
      fieldCount(TasksPluginReminderModel.dueDateTimeFormat),
      DATE_TIME_FORMATTER.maxFieldCount(),
    );
  }

  /**
   * Whitespace-delimited prefixes of `text`, longest first.
   *
   * Capped, because each candidate is parsed as a whole: no date format in
   * play spans more fields than `maxLeadingFields()`, and the cap keeps the
   * scan bounded on the long prose lines this plugin routinely sees.
   */
  private static leadingCandidates(text: string): Array<string> {
    const out: Array<string> = [];
    const max = TasksPluginReminderModel.maxLeadingFields();
    const word = /\S+/g;
    let match: RegExpExecArray | null;
    while (out.length < max && (match = word.exec(text)) !== null) {
      out.push(text.slice(0, match.index + match[0].length));
    }
    return out.reverse();
  }

  /**
   * The date is the HEAD of the token's text, and only the head.
   *
   * A token runs to the next symbol *this plugin* knows, so it routinely
   * carries what it does not tokenise — the Tasks plugin's own ➕/🆔/⛔, a tag,
   * prose. moment's lenient mode searches such a string and borrows a date from
   * anywhere in it, which is how "⏳ no date here ➕ 2026-08-17" acquires a
   * scheduled date it does not have, and how "⏰ no date here ➕ 2026-08-17"
   * fabricates a midnight.
   *
   * The Tasks plugin anchors the other way — its regexes end in `$` and allow
   * only spaces between marker and date — so requiring the date at the head of
   * the token is that same invariant seen from this side. Parsing the whole
   * token strictly instead would reject every line that carries a marker this
   * plugin does not know, which is most of them.
   */
  private getDate(symbol: Symbol): DateTime | null {
    const dateText = this.tokens.getTokenText(
      symbol,
      true,
      this.carriesDate(symbol),
    );
    if (dateText === null) {
      return null;
    }
    for (const candidate of TasksPluginReminderModel.leadingCandidates(
      dateText,
    )) {
      const parsed = this.parseExactDate(symbol, candidate);
      if (parsed !== null) {
        return parsed;
      }
    }
    return null;
  }

  /**
   * Prefer-predicate for token resolution: does this token's text start with
   * a date this symbol accepts? A symbol that also occurs in prose produces
   * two tokens, and first-wins used to hand every reader — and the snooze
   * writer — the prose one, losing (or clobbering) the real date. All
   * resolution sites share this predicate so read, span and write land on
   * the same token.
   */
  private carriesDate(symbol: Symbol): (token: Token) => boolean {
    return (token) => {
      const text = token.text.replace(/^\s*(.*?)\s*$/, "$1");
      for (const candidate of TasksPluginReminderModel.leadingCandidates(
        text,
      )) {
        if (this.parseExactDate(symbol, candidate) !== null) {
          return true;
        }
      }
      return false;
    };
  }

  private parseExactDate(symbol: Symbol, text: string): DateTime | null {
    if (symbol === TasksPluginReminderModel.symbolReminder) {
      // ⏰ is this plugin's own symbol and its format is user-configured
      // (unlike 📅/⏳/🛫, whose format the Tasks plugin owns), so it honours
      // the "Strict date format" setting; `parseWhole` keeps the head-of-token
      // guarantee even on the lenient pass.
      return DATE_TIME_FORMATTER.parseWhole(text);
    }
    if (symbol === TasksPluginReminderModel.symbolDueDate) {
      // Opt-in extension: 📅 may also carry a time.
      const dateTime = moment(
        text,
        TasksPluginReminderModel.dueDateTimeFormat,
        true,
      );
      if (dateTime.isValid()) {
        return new DateTime(dateTime, true);
      }
    }
    const date = moment(text, TasksPluginReminderModel.dateFormat, true);
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
      this.carriesDate(symbol),
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
