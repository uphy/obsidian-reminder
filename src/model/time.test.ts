/**
 * @fileoverview Tests for DateTime, Time, and Later model classes.
 *
 * These classes are used throughout the reschedule feature for:
 * - DateTime: representing reminder dates/times, calculating reschedule targets (e.g. +3h, +1d, +1w)
 * - Time: parsing and representing HH:mm time values for the time picker
 * - Later: parsing "remind me later" expressions like "In 3 hours", "Tomorrow", "Next week"
 *
 * @see src/model/time.ts
 */

import moment from "moment";
import { DateTime, Time, Later, parseLater, parseLaters, inHours, inDays, inWeeks, tomorrow, nextWeek } from "./time";

/**
 * DateTime class tests.
 * DateTime wraps moment.js and adds:
 * - hasTimePart flag (date-only vs date+time)
 * - Static factory methods (now, parse)
 * - Arithmetic (add days/hours/weeks)
 * - Formatting with default time fallback
 */
describe("DateTime", (): void => {
  test("now() returns a DateTime with time part", (): void => {
    const now = DateTime.now();
    expect(now.hasTimePart).toBe(true);
    expect(now.isValid()).toBe(true);
  });

  test("parse() with date and time", (): void => {
    const dt = DateTime.parse("2021-09-14 10:30");
    expect(dt.hasTimePart).toBe(true);
    expect(dt.toString()).toBe("2021-09-14 10:30");
  });

  test("parse() with date only", (): void => {
    const dt = DateTime.parse("2021-09-14");
    expect(dt.hasTimePart).toBe(false);
    expect(dt.toString()).toBe("2021-09-14");
  });

  test("format() with custom format", (): void => {
    const dt = DateTime.parse("2021-09-14 10:30");
    expect(dt.format("YYYY/MM/DD")).toBe("2021/09/14");
    expect(dt.format("HH:mm")).toBe("10:30");
  });

  test("toYYYYMMDD()", (): void => {
    const dt = DateTime.parse("2021-09-14");
    expect(dt.toYYYYMMDD()).toBe("2021-09-14");
  });

  /** Used by the "In 3 hours" quick reschedule option */
  test("add() hours", (): void => {
    const dt = DateTime.parse("2021-09-14 10:00");
    const result = dt.add(3, "hours");
    expect(result.toString()).toBe("2021-09-14 13:00");
    expect(result.hasTimePart).toBe(true);
  });

  /** Used by the "Tomorrow" quick reschedule option */
  test("add() days", (): void => {
    const dt = DateTime.parse("2021-09-14 10:00");
    const result = dt.add(1, "days");
    expect(result.toString()).toBe("2021-09-15 10:00");
  });

  /** Used by the "Next week" quick reschedule option */
  test("add() weeks", (): void => {
    const dt = DateTime.parse("2021-09-14 10:00");
    const result = dt.add(1, "weeks");
    expect(result.toString()).toBe("2021-09-21 10:00");
  });

  test("add() preserves hasTimePart for date-only", (): void => {
    const dt = DateTime.parse("2021-09-14");
    const result = dt.add(1, "days");
    expect(result.hasTimePart).toBe(false);
  });

  test("clone()", (): void => {
    const dt = DateTime.parse("2021-09-14 10:00");
    const cloned = dt.clone();
    expect(cloned.toString()).toBe(dt.toString());
    expect(cloned.hasTimePart).toBe(dt.hasTimePart);
  });

  test("equals()", (): void => {
    const dt1 = DateTime.parse("2021-09-14 10:00");
    const dt2 = DateTime.parse("2021-09-14 10:00");
    const dt3 = DateTime.parse("2021-09-14 11:00");
    expect(dt1.equals(dt2)).toBe(true);
    expect(dt1.equals(dt3)).toBe(false);
  });

  test("equals() returns false for different hasTimePart", (): void => {
    const dt1 = DateTime.parse("2021-09-14");
    const dt2 = DateTime.parse("2021-09-14 00:00");
    expect(dt1.equals(dt2)).toBe(false);
  });

  test("isValid()", (): void => {
    const dt = DateTime.parse("2021-09-14");
    expect(dt.isValid()).toBe(true);
  });

  test("moment() returns the underlying moment object", (): void => {
    const dt = DateTime.parse("2021-09-14");
    expect(dt.moment().format("YYYY-MM-DD")).toBe("2021-09-14");
  });
});

/**
 * Time class tests.
 * Time represents a HH:mm time value used by the time picker in the reschedule modal.
 */
describe("Time", (): void => {
  test("parse() valid time", (): void => {
    const t = Time.parse("10:30");
    expect(t.toString()).toBe("10:30");
  });

  test("parse() pads single digits", (): void => {
    const t = Time.parse("9:05");
    expect(t.toString()).toBe("09:05");
  });

  test("parse() throws on invalid format", (): void => {
    expect(() => Time.parse("10")).toThrow();
    expect(() => Time.parse("10:30:00")).toThrow();
    expect(() => Time.parse("abc")).toThrow();
  });

  test("parse() throws on out of range", (): void => {
    expect(() => Time.parse("25:00")).toThrow();
    expect(() => Time.parse("10:60")).toThrow();
    expect(() => Time.parse("-1:30")).toThrow();
  });

  test("minutes getter", (): void => {
    expect(Time.parse("10:30").minutes).toBe(630);
    expect(Time.parse("00:00").minutes).toBe(0);
    expect(Time.parse("23:59").minutes).toBe(1439);
  });
});

/**
 * Later class and helper function tests.
 * Later represents a "remind me later" option with a label and a function
 * that calculates the target DateTime. Used by the context menu quick options
 * and the notification modal's "Remind Me Later" buttons.
 */
describe("Later", (): void => {
  test("parseLater 'In N minutes'", (): void => {
    const later = parseLater("In 30 minutes");
    expect(later.label).toBe("In 30 minutes");
    const result = later.later();
    expect(result.hasTimePart).toBe(true);
  });

  test("parseLater 'In N hours'", (): void => {
    const later = parseLater("In 3 hours");
    expect(later.label).toBe("In 3 hours");
  });

  test("parseLater 'Tomorrow'", (): void => {
    const later = parseLater("Tomorrow");
    expect(later.label).toBe("Tomorrow");
  });

  test("parseLater 'Next week'", (): void => {
    const later = parseLater("Next week");
    expect(later.label).toBe("Next week");
  });

  test("parseLater 'Next Monday'", (): void => {
    const later = parseLater("Next Monday");
    expect(later.label).toBe("Next Monday");
  });

  test("parseLater throws on unsupported format", (): void => {
    expect(() => parseLater("invalid")).toThrow();
  });

  test("parseLaters parses multiple laters", (): void => {
    const laters = parseLaters("In 30 minutes\nTomorrow\nNext week");
    expect(laters.length).toBe(3);
    expect(laters[0]!.label).toBe("In 30 minutes");
    expect(laters[1]!.label).toBe("Tomorrow");
    expect(laters[2]!.label).toBe("Next week");
  });

  /** Used by the "In 3 hours" quick reschedule context menu option */
  test("inHours helper", (): void => {
    const later = inHours(3);
    const result = later();
    expect(result.hasTimePart).toBe(true);
  });

  test("inDays helper", (): void => {
    const later = inDays(1);
    const result = later();
    expect(result.hasTimePart).toBe(true);
  });

  test("inWeeks helper", (): void => {
    const later = inWeeks(1);
    const result = later();
    expect(result.hasTimePart).toBe(true);
  });

  test("tomorrow helper", (): void => {
    const later = tomorrow();
    const result = later();
    expect(result.hasTimePart).toBe(false);
  });

  test("nextWeek helper", (): void => {
    const later = nextWeek();
    const result = later();
    expect(result.hasTimePart).toBe(false);
  });
});
