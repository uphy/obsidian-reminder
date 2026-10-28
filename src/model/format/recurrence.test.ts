import { DateTime } from "model/time";
import { moment } from "model/moment";
import { nextOccurrence } from "./recurrence";

describe("nextOccurrence()", (): void => {
  test("every day", (): void => {
    const dtStart = moment("2026-07-01 09:00");
    const now = new DateTime(moment("2026-07-01 08:00"), true);
    const next = nextOccurrence("every day", dtStart, now);
    expect(next).not.toBeUndefined();
    expect(moment(next).format("YYYY-MM-DD HH:mm")).toBe("2026-07-02 09:00");
  });

  test("every friday", (): void => {
    const dtStart = moment("2026-07-01 09:00"); // Wednesday
    const now = new DateTime(moment("2026-07-01 08:00"), true);
    const next = nextOccurrence("every friday", dtStart, now);
    expect(next).not.toBeUndefined();
    expect(moment(next).format("YYYY-MM-DD HH:mm dddd")).toBe(
      "2026-07-03 09:00 Friday",
    );
  });

  test("every month", (): void => {
    const dtStart = moment("2026-07-01 09:00");
    const now = new DateTime(moment("2026-07-01 08:00"), true);
    const next = nextOccurrence("every month", dtStart, now);
    expect(next).not.toBeUndefined();
    expect(moment(next).format("YYYY-MM-DD HH:mm")).toBe("2026-08-01 09:00");
  });

  test("now more than one period after dtStart re-anchors to now's date", (): void => {
    const dtStart = moment("2026-07-01 09:00");
    const now = new DateTime(moment("2026-07-10 08:00"), true);
    const next = nextOccurrence("every day", dtStart, now);
    expect(next).not.toBeUndefined();
    // Re-anchored to now's date (2026-07-10), not dtStart + 1 day
    // (2026-07-02), keeping the original time of day.
    expect(moment(next).format("YYYY-MM-DD HH:mm")).toBe("2026-07-11 09:00");
  });

  test("unrecognized input returns undefined without warning (parseText returns null, doesn't throw)", (): void => {
    const dtStart = moment("2026-07-01 09:00");
    const now = new DateTime(moment("2026-07-01 08:00"), true);
    const warn = jest.spyOn(console, "warn").mockImplementation();
    const next = nextOccurrence(
      "not a real recurrence text at all",
      dtStart,
      now,
    );
    expect(next).toBeUndefined();
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  test("throwing input ('every') returns undefined and logs a warning", (): void => {
    const dtStart = moment("2026-07-01 09:00");
    const now = new DateTime(moment("2026-07-01 08:00"), true);
    const warn = jest.spyOn(console, "warn").mockImplementation();
    const next = nextOccurrence("every", dtStart, now);
    expect(next).toBeUndefined();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  test("throwing input ('until 2026-01-01') returns undefined and logs a warning", (): void => {
    const dtStart = moment("2026-07-01 09:00");
    const now = new DateTime(moment("2026-07-01 08:00"), true);
    const warn = jest.spyOn(console, "warn").mockImplementation();
    const next = nextOccurrence("until 2026-01-01", dtStart, now);
    expect(next).toBeUndefined();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  test("until: completed well before the until date yields a next occurrence", (): void => {
    const dtStart = moment("2026-07-01 09:00");
    const now = new DateTime(moment("2026-07-02 08:00"), true);
    const next = nextOccurrence("every day until 2026-07-10", dtStart, now);
    expect(next).not.toBeUndefined();
  });

  test("until: completed clearly after the until date ends the series (no warning)", (): void => {
    const dtStart = moment("2026-07-01 09:00");
    const now = new DateTime(moment("2026-07-20 08:00"), true);
    const warn = jest.spyOn(console, "warn").mockImplementation();
    const next = nextOccurrence("every day until 2026-07-10", dtStart, now);
    expect(next).toBeUndefined();
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  test("count rules never end the series: 'every day for 3 times' still yields a next occurrence after three completions", (): void => {
    // dtStart is rebuilt from the current due date on every completion, and
    // RRule counts `count` from `dtstart`, so each completion restarts a
    // fresh 3-count window.
    let dtStart = moment("2026-07-01 09:00");
    const now = new DateTime(moment("2026-07-01 08:00"), true);

    let next = nextOccurrence("every day for 3 times", dtStart, now);
    expect(next).not.toBeUndefined();
    dtStart = moment(next);

    next = nextOccurrence("every day for 3 times", dtStart, now);
    expect(next).not.toBeUndefined();
    dtStart = moment(next);

    next = nextOccurrence("every day for 3 times", dtStart, now);
    expect(next).not.toBeUndefined();
  });

  test("count rules never end the series even when completed more than N periods late", (): void => {
    const dtStart = moment("2026-07-01 09:00");
    const now = new DateTime(moment("2026-07-20 08:00"), true);
    const next = nextOccurrence("every day for 3 times", dtStart, now);
    expect(next).not.toBeUndefined();
    expect(moment(next).format("YYYY-MM-DD HH:mm")).toBe("2026-07-21 09:00");
  });

  test("'for 1 time' has no occurrence after dtStart", (): void => {
    const dtStart = moment("2026-07-01 09:00");
    const now = new DateTime(moment("2026-07-01 08:00"), true);
    const next = nextOccurrence("every day for 1 time", dtStart, now);
    expect(next).toBeUndefined();
  });

  test("does not mutate the dtStart moment nor the now DateTime", (): void => {
    const dtStart = moment("2026-07-01 09:00");
    const dtStartBefore = dtStart.clone();
    const now = new DateTime(moment("2026-07-01 08:00"), true);
    const nowMomentBefore = now.moment().clone();

    nextOccurrence("every day", dtStart, now);

    expect(dtStart.isSame(dtStartBefore)).toBe(true);
    expect(now.moment().isSame(nowMomentBefore)).toBe(true);
  });

  test("does not mutate the dtStart moment nor the now DateTime, even on the re-anchoring branch", (): void => {
    const dtStart = moment("2026-07-01 09:00");
    const dtStartBefore = dtStart.clone();
    // now is well after dtStart, so the re-anchoring branch
    // (`dtStart = today`) is exercised.
    const now = new DateTime(moment("2026-07-10 08:00"), true);
    const nowMomentBefore = now.moment().clone();

    nextOccurrence("every day", dtStart, now);

    expect(dtStart.isSame(dtStartBefore)).toBe(true);
    expect(now.moment().isSame(nowMomentBefore)).toBe(true);
  });

  describe("recurrence anchor preservation and 'when done'", (): void => {
    test("every Year preserves month and day even when completed months later", (): void => {
      // Valentine's notification Jan 5, completed in October
      const reminderDate = moment("2026-01-05");
      const dueDate = moment("2026-02-14");
      const now = new DateTime(moment("2026-10-17 12:00"), true);

      const nextReminder = nextOccurrence("every Year", reminderDate, now);
      const nextDue = nextOccurrence("every Year", dueDate, now);

      expect(nextReminder).not.toBeUndefined();
      expect(moment(nextReminder).format("YYYY-MM-DD")).toBe("2027-01-05");

      expect(nextDue).not.toBeUndefined();
      expect(moment(nextDue).format("YYYY-MM-DD")).toBe("2027-02-14");
    });

    test("every Year preserves month and day when completed on Valentine's Day", (): void => {
      // Completed on Feb 14: reminder was Jan 5 (already past), due date is Feb 14 (today)
      const reminderDate = moment("2026-01-05");
      const dueDate = moment("2026-02-14");
      const now = new DateTime(moment("2026-02-14 18:00"), true);

      const nextReminder = nextOccurrence("every Year", reminderDate, now);
      const nextDue = nextOccurrence("every Year", dueDate, now);

      expect(moment(nextReminder).format("YYYY-MM-DD")).toBe("2027-01-05");
      expect(moment(nextDue).format("YYYY-MM-DD")).toBe("2027-02-14");
    });

    test("case insensitivity: 'every Year', 'every year', 'Every Year'", (): void => {
      const dtStart = moment("2026-01-05");
      const now = new DateTime(moment("2026-01-05 10:00"), true);

      for (const expr of [
        "every Year",
        "every year",
        "Every Year",
        "EVERY YEAR",
      ]) {
        const next = nextOccurrence(expr, dtStart, now);
        expect(next).not.toBeUndefined();
        expect(moment(next).format("YYYY-MM-DD")).toBe("2027-01-05");
      }
    });

    test("every month preserves the anchor day of month when completed later in the month", (): void => {
      const dtStart = moment("2026-01-01");
      const now = new DateTime(moment("2026-01-05 10:00"), true);

      const next = nextOccurrence("every month", dtStart, now);
      expect(next).not.toBeUndefined();
      expect(moment(next).format("YYYY-MM-DD")).toBe("2026-02-01");
    });

    test("every week preserves the anchor day of week when completed later in the week", (): void => {
      const monday = moment("2026-01-05"); // Monday
      const wednesday = new DateTime(moment("2026-01-07 10:00"), true);

      const next = nextOccurrence("every week", monday, wednesday);
      expect(next).not.toBeUndefined();
      expect(moment(next).format("YYYY-MM-DD dddd")).toBe("2026-01-12 Monday");
    });

    test("'when done' modifier recalculates from completion date", (): void => {
      const dtStart = moment("2026-01-05 09:00");
      const now = new DateTime(moment("2026-10-17 14:00"), true);

      const next = nextOccurrence("every Year when done", dtStart, now);
      expect(next).not.toBeUndefined();
      expect(moment(next).format("YYYY-MM-DD HH:mm")).toBe("2027-10-17 09:00");
    });

    test("every month from month-end clamps to the end of short months", (): void => {
      const jan31 = moment("2026-01-31 09:00");
      const feb01 = new DateTime(moment("2026-02-01 08:00"), true);

      const nextFeb = nextOccurrence("every month", jan31, feb01);
      expect(nextFeb).not.toBeUndefined();
      expect(moment(nextFeb).format("YYYY-MM-DD HH:mm")).toBe(
        "2026-02-28 09:00",
      );

      // In a leap year, Jan 31 clamps to Feb 29.
      const leapJan31 = moment("2024-01-31 09:00");
      const leapFeb01 = new DateTime(moment("2024-02-01 08:00"), true);
      const nextLeapFeb = nextOccurrence("every month", leapJan31, leapFeb01);
      expect(nextLeapFeb).not.toBeUndefined();
      expect(moment(nextLeapFeb).format("YYYY-MM-DD HH:mm")).toBe(
        "2024-02-29 09:00",
      );
    });

    test("preserves milliseconds from dtStart", (): void => {
      const dtStart = moment("2026-07-01 09:00:00.123");
      const now = new DateTime(moment("2026-07-01 08:00"), true);
      const next = nextOccurrence("every day", dtStart, now);
      expect(next).not.toBeUndefined();
      expect(next!.getMilliseconds()).toBe(123);
    });
  });
});
