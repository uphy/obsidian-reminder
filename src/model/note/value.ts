import { moment } from "model/moment";
import { DateTime } from "model/time";
import type { Time } from "model/time";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const DATE_TIME = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2})?$/;

/**
 * Parses a frontmatter value as a reminder time.
 *
 * Two shapes are times: a date (`2026-11-20`) and a date-time
 * (`2026-11-20T09:00`, with `T` or one space, with or without seconds).
 * Obsidian's YAML parser hands both over as strings. Seconds are dropped.
 *
 * Everything else is not a time, including a value with `Z`, a UTC offset or
 * fractional seconds: Obsidian's property editor never writes those, and
 * reading them would mean deciding in which zone to write them back.
 */
export function parseTimeValue(value: unknown): DateTime | null {
  if (typeof value !== "string") {
    return null;
  }
  const text = value.trim();
  if (DATE.test(text)) {
    const m = moment(text, "YYYY-MM-DD", true);
    return m.isValid() ? new DateTime(m, false) : null;
  }
  if (!DATE_TIME.test(text)) {
    return null;
  }
  const m = moment(
    text.replace(" ", "T"),
    ["YYYY-MM-DDTHH:mm:ss", "YYYY-MM-DDTHH:mm"],
    true,
  );
  return m.isValid() ? new DateTime(m.seconds(0), true) : null;
}

/**
 * The text written to frontmatter: the forms Obsidian's own property editor
 * writes for a "date" and for a "date & time" property.
 */
export function formatTimeValue(time: DateTime): string {
  return time.hasTimePart
    ? time.format("YYYY-MM-DDTHH:mm:00")
    : time.format("YYYY-MM-DD");
}

/**
 * Same shape (date or date-time) and the same minute. A date and the
 * date-time at midnight of that day are different times.
 */
export function sameTime(a: DateTime, b: DateTime): boolean {
  return (
    a.hasTimePart === b.hasTimePart &&
    a.format("YYYY-MM-DDTHH:mm") === b.format("YYYY-MM-DDTHH:mm")
  );
}

/**
 * True when `time` falls on a day before `since` (`YYYY-MM-DD`). An empty
 * `since` means there is no cut-off.
 */
export function isBeforeDay(time: DateTime, since: string): boolean {
  if (since === "") {
    return false;
  }
  return time.format("YYYY-MM-DD") < since;
}

/** True for a property that is absent or holds nothing. */
export function isEmptyValue(value: unknown): boolean {
  return value == null || value === "";
}

/**
 * `time` in the shape of an existing value, so that moving a reminder never
 * turns a date into a date-time or the other way round. A date moved onto a
 * date-time value starts at midnight unless the caller chose a time.
 */
export function inShapeOf(time: DateTime, hasTimePart: boolean): DateTime {
  if (time.hasTimePart === hasTimePart) {
    return time;
  }
  const m = time.moment().clone();
  return new DateTime(hasTimePart ? m.startOf("day") : m, hasTimePart);
}

/**
 * The time a snooze writes for a reminder currently at `current`.
 *
 * A whole-day choice ("Tomorrow") for a reminder that has a time of day gets
 * `defaultTime` (the "Reminder Time" setting) on that day, as a date-only
 * task line would be notified. Everything else is put in the shape of
 * `current` (see `inShapeOf`).
 */
export function snoozeTimeFor(
  current: DateTime,
  chosen: DateTime,
  defaultTime: Time,
): DateTime {
  if (current.hasTimePart && !chosen.hasTimePart) {
    const day = moment(chosen.format("YYYY-MM-DD"), "YYYY-MM-DD", true);
    return new DateTime(day.add(defaultTime.minutes, "minutes"), true);
  }
  return inShapeOf(chosen, current.hasTimePart);
}
