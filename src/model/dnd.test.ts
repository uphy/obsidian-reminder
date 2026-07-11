import { isNotificationPaused } from "./dnd";
import { DateTime } from "./time";

describe("isNotificationPaused()", (): void => {
  test("returns false when dndUntil is not set", (): void => {
    expect(isNotificationPaused(null, DateTime.parse("2021-09-08 10:00"))).toBe(
      false,
    );
  });

  test("returns true when now is before dndUntil", (): void => {
    const dndUntil = DateTime.parse("2021-09-08 11:00");
    const now = DateTime.parse("2021-09-08 10:00");

    expect(isNotificationPaused(dndUntil, now)).toBe(true);
  });

  test("returns false once now reaches dndUntil", (): void => {
    const dndUntil = DateTime.parse("2021-09-08 11:00");

    expect(isNotificationPaused(dndUntil, dndUntil)).toBe(false);
  });

  test("returns false once now is after dndUntil", (): void => {
    const dndUntil = DateTime.parse("2021-09-08 11:00");
    const now = DateTime.parse("2021-09-08 12:00");

    expect(isNotificationPaused(dndUntil, now)).toBe(false);
  });
});
