import type { DateTime } from "model/time";
import type { Moment } from "moment";
import { RRule } from "rrule";

/**
 * Compute the next occurrence of a recurrence rule after `dtStart` and `now`.
 *
 * By default, recurrence is anchored to `dtStart` (preserving its weekday /
 * day of month / month of year) and advances past `now`. When `recurrence`
 * includes `when done`, the series is re-anchored to `now`'s date instead.
 *
 * Both `dtStart` and the moment inside `now` are cloned on entry: neither
 * argument is mutated by this function.
 *
 * @param recurrence natural-language recurrence text accepted by
 *   `RRule.parseText` (e.g. "every day", "every month on the 1st"), optionally
 *   suffixed with "when done".
 * @param dtStart the current occurrence's date/time; recurrence is computed
 *   relative to this (unless "when done" is specified).
 * @param now the current time, used to advance overdue series past today (or
 *   as the new anchor when "when done" is specified) while keeping `dtStart`'s
 *   time of day.
 * @returns the next occurrence, or `undefined` when the recurrence text
 *   can't be parsed (a warning is logged in that case) or the series has
 *   legitimately ended (an `until` rule whose date has passed, or `for 1 time`).
 */
export function nextOccurrence(
  recurrence: string,
  dtStart: Moment,
  now: DateTime,
): Date | undefined {
  const isWhenDone = /\bwhen\s+done\b/i.test(recurrence);
  const cleanedRecurrence = recurrence.replace(/\bwhen\s+done\b/gi, "").trim();

  let rruleOptions;
  try {
    rruleOptions = RRule.parseText(cleanedRecurrence);
  } catch (e) {
    console.warn(
      "Failed to parse recurrence text: recurrence=%s, error=%o",
      recurrence,
      e,
    );
    return undefined;
  }
  if (!rruleOptions) {
    return undefined;
  }

  dtStart = dtStart.clone();
  const timeOfDay = {
    hour: dtStart.get("hour"),
    minute: dtStart.get("minute"),
    second: dtStart.get("second"),
    millisecond: dtStart.get("millisecond"),
  };

  let anchor: Moment;
  let afterDate: Moment;
  if (isWhenDone) {
    anchor = now.moment().clone().set(timeOfDay);
    afterDate = anchor.clone();
  } else {
    anchor = dtStart.clone();
    afterDate = now.moment().clone().set(timeOfDay);
    if (afterDate.isBefore(anchor)) {
      afterDate = anchor.clone();
    }
  }

  // Count rules with count > 1 never end the series because the markdown line
  // does not track remaining occurrences across completions. Keeping `count`
  // when anchored to `dtStart` would cause `rrule.after()` to return null if
  // the task is completed more than `count` periods late. (`for 1 time` has
  // `count === 1` and intentionally yields no occurrence after `dtStart`.)
  if (rruleOptions.count != null && rruleOptions.count > 1) {
    delete rruleOptions.count;
  }

  // Clamp month-end dates (29th, 30th, 31st) to the last day of short months
  // (e.g. Jan 31 -> Feb 28/29 instead of skipping February to Mar 31),
  // matching the Tasks plugin's behavior when no explicit day rule is given.
  if (
    rruleOptions.freq === RRule.MONTHLY &&
    rruleOptions.bymonthday == null &&
    rruleOptions.byweekday == null &&
    rruleOptions.bynweekday == null &&
    rruleOptions.bysetpos == null &&
    anchor.date() >= 29
  ) {
    const targetDay = anchor.date();
    rruleOptions.bymonthday = Array.from(
      { length: targetDay - 28 + 1 },
      (_, i) => 28 + i,
    );
    rruleOptions.bysetpos = -1;
  } else if (
    rruleOptions.freq === RRule.YEARLY &&
    rruleOptions.bymonth == null &&
    rruleOptions.bymonthday == null &&
    rruleOptions.byweekday == null &&
    rruleOptions.bynweekday == null &&
    rruleOptions.bysetpos == null &&
    anchor.month() === 1 &&
    anchor.date() === 29
  ) {
    rruleOptions.bymonth = [2];
    rruleOptions.bymonthday = [28, 29];
    rruleOptions.bysetpos = -1;
  }

  const base = anchor.clone();
  const utcAnchor = anchor.clone().utc(true);
  rruleOptions.dtstart = utcAnchor.toDate();
  const rrule = new RRule(rruleOptions);

  const utcAfterDate = afterDate.clone().utc(true);
  const rdate = rrule.after(utcAfterDate.toDate(), false);
  if (rdate == null) {
    return undefined;
  }

  const next = base.clone();
  next.set({
    year: rdate.getUTCFullYear(),
    month: rdate.getUTCMonth(),
    date: rdate.getUTCDate(),
    hour: rdate.getUTCHours(),
    minute: rdate.getUTCMinutes(),
    second: rdate.getUTCSeconds(),
  });
  return next.toDate();
}
