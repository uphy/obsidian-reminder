import { DateTime, Time } from "model/time";
import {
  formatTimeValue,
  inShapeOf,
  isBeforeDay,
  isEmptyValue,
  parseTimeValue,
  sameTime,
  snoozeTimeFor,
} from "./value";

function parsed(value: unknown): string | null {
  const time = parseTimeValue(value);
  return time == null ? null : formatTimeValue(time);
}

describe("parseTimeValue()", (): void => {
  test("a date", (): void => {
    expect(parsed("2026-11-20")).toBe("2026-11-20");
    expect(parseTimeValue("2026-11-20")?.hasTimePart).toBe(false);
  });

  test("a date-time with T, with a space, with seconds", (): void => {
    expect(parsed("2026-11-20T09:05")).toBe("2026-11-20T09:05:00");
    expect(parsed("2026-11-20 09:05")).toBe("2026-11-20T09:05:00");
    expect(parsed("2026-11-20T09:05:00")).toBe("2026-11-20T09:05:00");
    expect(parseTimeValue("2026-11-20T09:05")?.hasTimePart).toBe(true);
  });

  test("seconds are dropped", (): void => {
    expect(parsed("2026-11-20T09:05:30")).toBe("2026-11-20T09:05:00");
  });

  test("surrounding spaces are ignored", (): void => {
    expect(parsed("  2026-11-20 ")).toBe("2026-11-20");
  });

  test("anything else is not a time", (): void => {
    for (const value of [
      "tomorrow",
      "",
      "2026-11-20T09:05:00Z",
      "2026-11-20T09:05:00+09:00",
      "2026-11-20T09:05:00.123",
      "2026-11-20T9:05",
      "2026-02-30",
      "2026-11-20T25:00",
      20261120,
      true,
      ["2026-11-20"],
      null,
      undefined,
      { date: "2026-11-20" },
    ]) {
      expect(parseTimeValue(value)).toBeNull();
    }
  });
});

describe("sameTime()", (): void => {
  const time = (text: string): DateTime => parseTimeValue(text)!;

  test("a date and its midnight date-time differ", (): void => {
    expect(sameTime(time("2026-11-20"), time("2026-11-20T00:00"))).toBe(false);
  });

  test("times in the same minute are equal", (): void => {
    expect(
      sameTime(time("2026-11-20T09:00:30"), time("2026-11-20T09:00:00")),
    ).toBe(true);
    expect(sameTime(time("2026-11-20"), time("2026-11-20"))).toBe(true);
    expect(sameTime(time("2026-11-20T09:00"), time("2026-11-20T09:01"))).toBe(
      false,
    );
  });
});

describe("isBeforeDay()", (): void => {
  const time = (text: string): DateTime => parseTimeValue(text)!;

  test("the cut-off day itself is not before the cut-off", (): void => {
    expect(isBeforeDay(time("2026-11-19"), "2026-11-20")).toBe(true);
    expect(isBeforeDay(time("2026-11-19T23:59"), "2026-11-20")).toBe(true);
    expect(isBeforeDay(time("2026-11-20"), "2026-11-20")).toBe(false);
    expect(isBeforeDay(time("2026-11-20T00:00"), "2026-11-20")).toBe(false);
  });

  test("an empty cut-off hides nothing", (): void => {
    expect(isBeforeDay(time("1999-01-01"), "")).toBe(false);
  });
});

describe("isEmptyValue()", (): void => {
  test("null, undefined and the empty string are empty", (): void => {
    expect(isEmptyValue(null)).toBe(true);
    expect(isEmptyValue(undefined)).toBe(true);
    expect(isEmptyValue("")).toBe(true);
    expect(isEmptyValue(false)).toBe(false);
    expect(isEmptyValue(0)).toBe(false);
  });
});

describe("inShapeOf()", (): void => {
  const time = (text: string): DateTime => parseTimeValue(text)!;

  test("a date-time becomes a date for a date value", (): void => {
    expect(formatTimeValue(inShapeOf(time("2026-11-21T09:30"), false))).toBe(
      "2026-11-21",
    );
  });

  test("a date becomes midnight for a date-time value", (): void => {
    expect(formatTimeValue(inShapeOf(time("2026-11-21"), true))).toBe(
      "2026-11-21T00:00:00",
    );
  });

  test("a matching shape is returned as is", (): void => {
    const original = time("2026-11-21T09:30");
    expect(inShapeOf(original, true)).toBe(original);
  });
});

describe("snoozeTimeFor()", (): void => {
  const time = (text: string): DateTime => parseTimeValue(text)!;
  const reminderTime = Time.parse("09:00");
  const snoozed = (current: string, chosen: string): string =>
    formatTimeValue(snoozeTimeFor(time(current), time(chosen), reminderTime));

  test("a whole-day choice for a date-time gets the reminder time", (): void => {
    expect(snoozed("2026-11-20T14:30", "2026-11-21")).toBe(
      "2026-11-21T09:00:00",
    );
  });

  test("a date stays a date", (): void => {
    expect(snoozed("2026-11-20", "2026-11-21")).toBe("2026-11-21");
    expect(snoozed("2026-11-20", "2026-11-21T15:00")).toBe("2026-11-21");
  });

  test("a timed choice for a date-time is kept", (): void => {
    expect(snoozed("2026-11-20T14:30", "2026-11-20T15:00")).toBe(
      "2026-11-20T15:00:00",
    );
  });
});
