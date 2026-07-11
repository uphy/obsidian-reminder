import type { DateTime } from "model/time";
import type { Moment } from "moment";
import { RRule } from "rrule";

/**
 * Compute the next occurrence of a recurrence rule after `dtStart`, anchored
 * to `now`.
 *
 * Both `dtStart` and the moment inside `now` are cloned on entry: neither
 * argument is mutated by this function.
 *
 * @param recurrence natural-language recurrence text accepted by
 *   `RRule.parseText` (e.g. "every day", "every month on the 1st").
 * @param dtStart the current occurrence's date/time; recurrence is computed
 *   relative to this.
 * @param now the current time, used to re-anchor overdue-by-multiple-periods
 *   series forward while keeping `dtStart`'s time of day.
 * @returns the next occurrence, or `undefined` when the recurrence text
 *   can't be parsed (a warning is logged in that case) or the series has
 *   legitimately ended (an `until` rule whose date has passed).
 */
export function nextOccurrence(
  recurrence: string,
  dtStart: Moment,
  now: DateTime,
): Date | undefined {
  let rruleOptions;
  try {
    rruleOptions = RRule.parseText(recurrence);
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

  const today = now.moment().clone();
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
