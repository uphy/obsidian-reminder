import { getLanguage, getLanguageSetting, momentLocaleOf, t } from "i18n";
import { ConstantReference } from "model/ref";
import type { ReadOnlyReference } from "model/ref";
import { moment } from "model/moment";

export class DateTime {
  public static now(): DateTime {
    return new DateTime(moment(), true);
  }

  public static parse(time: string): DateTime {
    if (time.length > 10) {
      return new DateTime(moment(time, "YYYY-MM-DD HH:mm"), true);
    } else {
      return new DateTime(moment(time, "YYYY-MM-DD"), false);
    }
  }

  /**
   * Builds a `DateTime` from an epoch-milliseconds timestamp. Used for
   * persisting values (e.g. do-not-disturb's `dndUntil`) that must survive a
   * round trip through storage without losing precision, unlike
   * `toString()`/`parse()` which are lossy for date-only `DateTime`s.
   */
  public static ofEpochMillis(epochMillis: number): DateTime {
    return new DateTime(moment(epochMillis), true);
  }

  public static duration(
    from: DateTime,
    to: DateTime,
    unit: Unit,
    defaultTime?: Time,
  ): number {
    return to.fixedTime(defaultTime).diff(from.fixedTime(defaultTime), unit);
  }

  constructor(
    private time: moment.Moment,
    private _hasTimePart: boolean,
  ) {}

  public getTimeInMillis(defaultTime?: Time): number {
    return this.fixedTime(defaultTime).valueOf();
  }

  public format(format: string, defaultTime?: Time) {
    return this.fixedTime(defaultTime).format(format);
  }

  /**
   * Formats this time for display in the plugin's language.
   *
   * Format tokens that spell out a name — `MMMM`, `ddd`, `A` — are rendered by
   * moment, whose locale is global to the app (Obsidian's moment instance is
   * shared with its own date parsing and with the dates this plugin writes to
   * the vault). Applying the selected language therefore happens on a clone of
   * this instance instead of through `moment.locale()`, so nothing outside the
   * plugin's own rendering changes. `format()` keeps the app's locale and is
   * what the parse/write paths use.
   */
  public formatForDisplay(format: string, defaultTime?: Time): string {
    const time = this.fixedTime(defaultTime);
    const locale = displayLocale();
    if (locale == null) {
      return time.format(format);
    }
    return time.clone().locale(locale).format(format);
  }

  public toYYYYMMMM(defaultTime?: Time): string {
    return this.fixedTime(defaultTime).format("YYYY, MMMM");
  }

  public toYYYYMMDD(defaultTime?: Time): string {
    return this.fixedTime(defaultTime).format("YYYY-MM-DD");
  }

  public add(amount: number, unit: Unit, defaultTime?: Time): DateTime {
    return new DateTime(
      this.fixedTime(defaultTime).clone().add(amount, unit),
      this._hasTimePart,
    );
  }

  private fixedTime(defaultTime?: Time): moment.Moment {
    if (this._hasTimePart) {
      return this.time;
    }
    if (defaultTime === undefined) {
      return this.time;
    }
    return this.time.clone().add(defaultTime.minutes, "minutes");
  }

  public get hasTimePart() {
    return this._hasTimePart;
  }

  public moment() {
    return this.time;
  }

  public isValid() {
    return this.time.isValid();
  }

  public clone(hasTimePart?: boolean) {
    const withTimePart = hasTimePart == null ? this._hasTimePart : hasTimePart;
    const clone = this.time.clone();
    return new DateTime(clone, withTimePart);
  }

  public toString(): string {
    if (this._hasTimePart) {
      return this.format("YYYY-MM-DD HH:mm");
    } else {
      return this.format("YYYY-MM-DD");
    }
  }

  public equals(time: DateTime) {
    return (
      this._hasTimePart === time._hasTimePart && this.time.isSame(time.time)
    );
  }
}

export class Time {
  public static parse(text: string): Time {
    const invalid = () =>
      t("Unexpected format time({time}). Time must be HH:mm.", { time: text });
    if (!text.match(/^\d{1,2}:\d{1,2}$/)) {
      throw new Error(invalid());
    }
    const s = text.split(":");
    if (s.length !== 2) {
      throw new Error(invalid());
    }
    const hour = parseInt(s[0]!);
    const minute = parseInt(s[1]!);
    if (hour > 23 || hour < 0) {
      throw new Error(t("hour must be 0~23"));
    }
    if (minute > 59 || minute < 0) {
      throw new Error(t("minute must be 0~59"));
    }
    return new Time(hour, minute);
  }
  private constructor(
    private hour: number,
    private minute: number,
  ) {}

  get minutes(): number {
    return this.hour * 60 + this.minute;
  }

  public toString(): string {
    const pad = (n: number): string => {
      if (n < 10) {
        return "0" + n;
      }
      return "" + n;
    };
    return `${pad(this.hour)}:${pad(this.minute)}`;
  }
}

export type later = () => DateTime;
type Unit =
  "seconds" | "minutes" | "hours" | "days" | "weeks" | "months" | "years";

function add(amount: number, unit: Unit): later {
  return () => {
    return new DateTime(moment(), true).add(amount, unit);
  };
}

export function inMinutes(minutes: number): later {
  return add(minutes, "minutes");
}

export function inHours(hours: number): later {
  return add(hours, "hours");
}

export function inDays(days: number): later {
  return add(days, "days");
}

export function inWeeks(weeks: number): later {
  return add(weeks, "weeks");
}

export function inMonths(months: number): later {
  return add(months, "months");
}

export function inYears(years: number): later {
  return add(years, "years");
}

export function nextWeekday(weekday: number): later {
  return () => {
    const today = moment();

    if (today.isoWeekday() <= weekday) {
      return new DateTime(today.isoWeekday(weekday), false);
    } else {
      return new DateTime(today.add(1, "weeks").isoWeekday(weekday), false);
    }
  };
}

export function tomorrow(): later {
  return () => {
    return new DateTime(moment().add(1, "days"), false);
  };
}

export function nextWeek(): later {
  return () => {
    return new DateTime(moment().add(1, "weeks"), false);
  };
}

export function nextMonth(): later {
  return () => {
    return new DateTime(moment().add(1, "months"), false);
  };
}

export function nextYear(): later {
  return () => {
    return new DateTime(moment().add(1, "years"), false);
  };
}

export class Later {
  constructor(
    public label: string,
    public later: later,
  ) {}
}

export function parseLaters(laters: string): Array<Later> {
  return laters.split("\n").map((l) => parseLater(l.trim()));
}

/**
 * The label of a relative "In N unit" option. The unit word is translated
 * separately so the whole phrase can be reordered per language; the parser
 * itself keeps accepting English input only.
 */
function inLabel(count: number, unit: string): string {
  return t("In {count} {unit}", { count, unit: t(unit) });
}

export function parseLater(later: string): Later {
  later = later.toLowerCase();
  if (later.startsWith("in")) {
    const tokens = later.split(" ");
    if (tokens.length !== 3) {
      throw new Error(
        t("Unsupported format.  Should be 'In N (minutes|hours)'"),
      );
    }
    const n =
      tokens[1] === "a" || tokens[1] === "an" ? 1 : parseInt(tokens[1]!);
    switch (tokens[2]) {
      case "minute":
      case "minutes": {
        const unit = n == 1 ? "minute" : "minutes";
        return new Later(inLabel(n, unit), inMinutes(n));
      }
      case "hour":
      case "hours": {
        const unit = n == 1 ? "hour" : "hours";
        return new Later(inLabel(n, unit), inHours(n));
      }
      case "day":
      case "days": {
        const unit = n == 1 ? "day" : "days";
        return new Later(inLabel(n, unit), inDays(n));
      }
      case "week":
      case "weeks": {
        const unit = n == 1 ? "week" : "weeks";
        return new Later(inLabel(n, unit), inWeeks(n));
      }
      case "month":
      case "months": {
        const unit = n == 1 ? "month" : "months";
        return new Later(inLabel(n, unit), inMonths(n));
      }
      case "year":
      case "years": {
        const unit = n == 1 ? "year" : "years";
        return new Later(inLabel(n, unit), inYears(n));
      }
    }
  } else if (later.startsWith("next")) {
    const weekday = later.substring(5);
    switch (weekday) {
      case "sunday":
        return new Later(t("Next Sunday"), nextWeekday(0));
      case "monday":
        return new Later(t("Next Monday"), nextWeekday(1));
      case "tuesday":
        return new Later(t("Next Tuesday"), nextWeekday(2));
      case "wednesday":
        return new Later(t("Next Wednesday"), nextWeekday(3));
      case "thursday":
        return new Later(t("Next Thursday"), nextWeekday(4));
      case "friday":
        return new Later(t("Next Friday"), nextWeekday(5));
      case "saturday":
        return new Later(t("Next Saturday"), nextWeekday(6));
      case "day":
        return new Later(t("Tomorrow"), tomorrow());
      case "week":
        return new Later(t("Next week"), nextWeek());
      case "month":
        return new Later(t("Next month"), nextMonth());
      case "year":
        return new Later(t("Next year"), nextYear());
      default:
        throw new Error(t("Unsupported weekday: {weekday}", { weekday }));
    }
  } else if (later === "tomorrow") {
    return new Later(t("Tomorrow"), tomorrow());
  }
  throw new Error(t("Unsupported format: {format}", { format: later }));
}

/**
 * The built-in "quick pick" snooze options. Built per call rather than kept as
 * a constant, so the labels follow a language change.
 */
export function defaultLaters(): Array<Later> {
  return [
    new Later(t("In 30 minutes"), inMinutes(30)),
    new Later(t("In 1 hours"), inHours(1)),
    new Later(t("In 3 hours"), inHours(3)),
    new Later(t("Tomorrow"), tomorrow()),
    new Later(t("Next week"), nextWeek()),
  ];
}

class DateTimeFormatter {
  private dateFormat: ReadOnlyReference<string> = new ConstantReference(
    "YYYY-MM-DD",
  );
  private dateTimeFormat: ReadOnlyReference<string> = new ConstantReference(
    "YYYY-MM-DD HH:mm",
  );
  private strict: ReadOnlyReference<boolean> = new ConstantReference(false);

  setTimeFormat(
    dateFormat: ReadOnlyReference<string>,
    dateTimeFormat: ReadOnlyReference<string>,
    strict: ReadOnlyReference<boolean>,
  ) {
    this.dateFormat = dateFormat;
    this.dateTimeFormat = dateTimeFormat;
    this.strict = strict;
  }

  /**
   * Parses `text` as a whole, never searching inside it.
   *
   * Like `parse()`, this honours the user's "Strict date format" setting — the
   * formats here are user-configured, so a strict-only pass would silently
   * reject dates the setting promises to accept. The difference is the lenient
   * fallback: moment's lenient mode *scans*, finding a date anywhere in the
   * string, so the fallback additionally requires that the whole input was
   * consumed (`parsingFlags().unusedInput` empty). A caller that has already
   * isolated a candidate gets "the candidate is exactly a date, or nothing"
   * without losing the leniency the setting asks for.
   */
  parseWhole(text: string): DateTime | null {
    const parsed = this.doParse(text, true);
    if (parsed != null) {
      return parsed;
    }
    if (this.strict.value) {
      return null;
    }
    return this.doParse(text, false, true);
  }

  parse(text: string): DateTime | null {
    const parsed = this.doParse(text, true);
    if (parsed != null) {
      return parsed;
    }
    if (this.strict.value) {
      return null;
    }
    return this.doParse(text, false);
  }

  private doParse(
    text: string,
    strict: boolean,
    requireWhole = false,
  ): DateTime | null {
    const whole = (m: moment.Moment): boolean =>
      !requireWhole || m.parsingFlags().unusedInput.length === 0;
    const dateTime = moment(text, this.dateTimeFormat.value, strict);
    if (dateTime.isValid() && whole(dateTime)) {
      return new DateTime(dateTime, true);
    }
    const date = moment(text, this.dateFormat.value, strict);
    if (date.isValid() && whole(date)) {
      return new DateTime(date, false);
    }
    return null;
  }

  /**
   * The larger whitespace-delimited field count of the two configured formats.
   * Callers that split candidates by whitespace use this to size their scan;
   * both formats are user-configurable, so the count cannot be a constant.
   */
  maxFieldCount(): number {
    return Math.max(
      fieldCount(this.dateFormat.value),
      fieldCount(this.dateTimeFormat.value),
    );
  }

  toString(time: DateTime): string {
    if (time.hasTimePart) {
      return time.format(this.dateTimeFormat.value);
    } else {
      return time.format(this.dateFormat.value);
    }
  }
}

function fieldCount(format: string): number {
  return (format.match(/\S+/g) ?? []).length;
}

/**
 * The moment locale to render display formats in, or `null` to leave the
 * instance on the app's locale.
 *
 * "Automatic" returns `null` on purpose: moment's locale is app-wide, Obsidian
 * already sets it from its own UI language, and that is the behavior the
 * display formats had before the language setting existed. An explicitly
 * selected language is applied per instance, and only when Obsidian's bundled
 * moment actually ships the locale -- otherwise moment would silently fall
 * back to English rather than the app's language.
 */
function displayLocale(): string | null {
  if (getLanguageSetting() === "auto") {
    return null;
  }
  const locale = momentLocaleOf(getLanguage());
  return moment.locales().includes(locale) ? locale : null;
}

export const DATE_TIME_FORMATTER = new DateTimeFormatter();
