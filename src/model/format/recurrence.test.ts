import { DateTime } from "model/time";
import moment from "moment";
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
});
