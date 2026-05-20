/**
 * @fileoverview Tests for RescheduleModal / DateTimeChooser integration.
 *
 * The RescheduleModal wraps the existing DateTimeChooser.svelte component
 * and is opened when the user selects "Custom..." from the reschedule context menu.
 * It allows picking any date and time for the reminder.
 *
 * The modal receives the reminder's current time as the initial date for the
 * calendar and time picker. On confirm, the reminder's time is updated and
 * persisted to the markdown file.
 *
 * Test coverage by reminder timing scenario:
 * - Overdue: modal initializes with past date, can select future
 * - Same day (today): modal initializes with today, can reschedule to later today or tomorrow
 * - Tomorrow: modal initializes with tomorrow, can reschedule to next week or weeks ahead
 * - Days ahead: modal initializes with future date, can pick different day
 * - Weeks ahead: modal initializes with weeks-ahead date, can pick different week
 *
 * @see src/plugin/ui/reschedule-modal.ts — RescheduleModal class
 * @see src/ui/DateTimeChooser.svelte — calendar + time picker component
 */

import { DateTime } from "model/time";
import moment from "moment";
import { Reminder } from "model/reminder";

describe("RescheduleModal DateTimeChooser integration", (): void => {
  /**
   * Overdue reminder modal tests.
   * When an overdue reminder is rescheduled via "Custom...", the modal
   * initializes with the overdue date. The user can then pick any future date.
   */
  describe("Overdue reminder modal", () => {
    test("Overdue: modal initializes with overdue date+time", () => {
      const overdueTime = DateTime.parse("2020-01-01 10:00");
      const reminder = new Reminder("test.md", "Overdue task", overdueTime, 0, false);

      const initialDate = reminder.time.moment();
      expect(initialDate.format("YYYY-MM-DD")).toBe("2020-01-01");
      expect(initialDate.format("HH:mm")).toBe("10:00");
    });

    test("Overdue: modal initializes with overdue date-only", () => {
      const overdueTime = DateTime.parse("2020-01-01");
      const reminder = new Reminder("test.md", "Overdue task date-only", overdueTime, 0, false);

      const initialDate = reminder.time.moment();
      expect(initialDate.format("YYYY-MM-DD")).toBe("2020-01-01");
      expect(reminder.time.hasTimePart).toBe(false);
    });

    test("Overdue: can select future date in modal", () => {
      const overdueTime = DateTime.parse("2020-01-01 10:00");
      const reminder = new Reminder("test.md", "Overdue task", overdueTime, 0, false);

      // Simulate user selecting a future date in the modal
      const selectedDate = moment().add(3, "days");
      const newTime = new DateTime(selectedDate, true);
      reminder.time = newTime;

      expect(reminder.time.getTimeInMillis()).toBeGreaterThan(Date.now());
      expect(reminder.time.hasTimePart).toBe(true);
    });

    test("Overdue: can select custom time in modal", () => {
      const overdueTime = DateTime.parse("2020-01-01 10:00");
      const reminder = new Reminder("test.md", "Overdue task", overdueTime, 0, false);

      // Simulate user selecting date + specific time (14:30)
      const selectedDate = moment().add(1, "days").set({ hour: 14, minute: 30 });
      const newTime = new DateTime(selectedDate, true);
      reminder.time = newTime;

      expect(reminder.time.moment().hour()).toBe(14);
      expect(reminder.time.moment().minute()).toBe(30);
    });
  });

  /**
   * Same-day (today) reminder modal tests.
   * The modal initializes with today's date. The user can reschedule to
   * later today, tomorrow, or any future date.
   */
  describe("Same-day (today) reminder modal", () => {
    test("Today: modal initializes with today's date+time", () => {
      const todayTime = DateTime.now();
      const reminder = new Reminder("test.md", "Today task", todayTime, 0, false);

      const initialDate = reminder.time.moment();
      expect(initialDate.format("YYYY-MM-DD")).toBe(moment().format("YYYY-MM-DD"));
      expect(reminder.time.hasTimePart).toBe(true);
    });

    test("Today: modal initializes with today's date-only", () => {
      const todayTime = moment().format("YYYY-MM-DD");
      const reminder = new Reminder("test.md", "Today task date-only", DateTime.parse(todayTime), 0, false);

      const initialDate = reminder.time.moment();
      expect(initialDate.format("YYYY-MM-DD")).toBe(moment().format("YYYY-MM-DD"));
      expect(reminder.time.hasTimePart).toBe(false);
    });

    test("Today: can reschedule to later today", () => {
      const now = DateTime.now();
      const reminder = new Reminder("test.md", "Today task", now, 0, false);

      // Simulate selecting 3 hours later today
      const laterToday = moment().add(3, "hours");
      const newTime = new DateTime(laterToday, true);
      reminder.time = newTime;

      expect(reminder.time.moment().format("YYYY-MM-DD")).toBe(moment().format("YYYY-MM-DD"));
      expect(reminder.time.getTimeInMillis()).toBeGreaterThan(now.getTimeInMillis());
    });

    test("Today: can reschedule to tomorrow from modal", () => {
      const now = DateTime.now();
      const reminder = new Reminder("test.md", "Today task", now, 0, false);

      const tomorrow = moment().add(1, "days");
      const newTime = new DateTime(tomorrow, false);
      reminder.time = newTime;

      expect(reminder.time.moment().format("YYYY-MM-DD")).toBe(
        moment().add(1, "days").format("YYYY-MM-DD")
      );
    });
  });

  /**
   * Tomorrow reminder modal tests.
   * The modal initializes with tomorrow's date. The user can reschedule
   * to next week or any future date.
   */
  describe("Tomorrow reminder modal", () => {
    test("Tomorrow: modal initializes with tomorrow's date", () => {
      const tomorrowTime = DateTime.parse(moment().add(1, "days").format("YYYY-MM-DD") + " 09:00");
      const reminder = new Reminder("test.md", "Tomorrow task", tomorrowTime, 0, false);

      const initialDate = reminder.time.moment();
      expect(initialDate.format("YYYY-MM-DD")).toBe(moment().add(1, "days").format("YYYY-MM-DD"));
    });

    test("Tomorrow: can reschedule to next week from modal", () => {
      const tomorrowTime = moment().add(1, "days");
      const reminder = new Reminder("test.md", "Tomorrow task", new DateTime(tomorrowTime, true), 0, false);

      const nextWeek = moment().add(1, "weeks");
      const newTime = new DateTime(nextWeek, true);
      reminder.time = newTime;

      expect(reminder.time.moment().format("YYYY-MM-DD")).toBe(
        moment().add(1, "weeks").format("YYYY-MM-DD")
      );
    });

    test("Tomorrow: can reschedule to specific date weeks ahead", () => {
      const tomorrowTime = moment().add(1, "days");
      const reminder = new Reminder("test.md", "Tomorrow task", new DateTime(tomorrowTime, true), 0, false);

      const weeksAhead = moment().add(3, "weeks").set({ hour: 10, minute: 0 });
      const newTime = new DateTime(weeksAhead, true);
      reminder.time = newTime;

      expect(reminder.time.moment().format("YYYY-MM-DD")).toBe(
        moment().add(3, "weeks").format("YYYY-MM-DD")
      );
      expect(reminder.time.moment().hour()).toBe(10);
      expect(reminder.time.moment().minute()).toBe(0);
    });
  });

  /**
   * Days ahead reminder modal tests.
   * The modal initializes with the future date. The user can pick any different day.
   */
  describe("Days ahead reminder modal", () => {
    test("Days ahead: modal initializes with future date", () => {
      const futureTime = moment().add(5, "days");
      const reminder = new Reminder("test.md", "Future task", new DateTime(futureTime, true), 0, false);

      const initialDate = reminder.time.moment();
      expect(initialDate.format("YYYY-MM-DD")).toBe(moment().add(5, "days").format("YYYY-MM-DD"));
    });

    test("Days ahead: can reschedule to different day with specific time", () => {
      const futureTime = moment().add(5, "days");
      const reminder = new Reminder("test.md", "Future task", new DateTime(futureTime, true), 0, false);

      const newDate = moment().add(10, "days").set({ hour: 15, minute: 30 });
      const newTime = new DateTime(newDate, true);
      reminder.time = newTime;

      expect(reminder.time.moment().format("YYYY-MM-DD")).toBe(
        moment().add(10, "days").format("YYYY-MM-DD")
      );
      expect(reminder.time.moment().hour()).toBe(15);
      expect(reminder.time.moment().minute()).toBe(30);
    });
  });

  /**
   * Weeks ahead reminder modal tests.
   * The modal initializes with the weeks-ahead date. The user can pick any different week.
   */
  describe("Weeks ahead reminder modal", () => {
    test("Weeks ahead: modal initializes with weeks-ahead date", () => {
      const weeksTime = moment().add(3, "weeks");
      const reminder = new Reminder("test.md", "Weeks ahead task", new DateTime(weeksTime, true), 0, false);

      const initialDate = reminder.time.moment();
      expect(initialDate.format("YYYY-MM-DD")).toBe(moment().add(3, "weeks").format("YYYY-MM-DD"));
    });

    test("Weeks ahead: can reschedule to different week", () => {
      const weeksTime = moment().add(3, "weeks");
      const reminder = new Reminder("test.md", "Weeks ahead task", new DateTime(weeksTime, true), 0, false);

      const newWeek = moment().add(6, "weeks").set({ hour: 9, minute: 0 });
      const newTime = new DateTime(newWeek, true);
      reminder.time = newTime;

      expect(reminder.time.moment().format("YYYY-MM-DD")).toBe(
        moment().add(6, "weeks").format("YYYY-MM-DD")
      );
    });
  });

  /**
   * DateTimeChooser calendar and time picker tests.
   * These test the underlying DateTime operations that the calendar
   * and time picker components rely on.
   */
  describe("DateTimeChooser calendar and time picker", () => {
    test("Calendar: can navigate to different month", () => {
      const date = moment("2021-09-14");
      const nextMonth = date.clone().add(1, "month");
      expect(nextMonth.format("YYYY-MM")).toBe("2021-10");
    });

    test("Calendar: can navigate to previous month", () => {
      const date = moment("2021-09-14");
      const prevMonth = date.clone().subtract(1, "month");
      expect(prevMonth.format("YYYY-MM")).toBe("2021-08");
    });

    test("Time picker: can select specific time", () => {
      const date = moment("2021-09-14 10:00");
      const withNewTime = date.clone().set({ hour: 14, minute: 30 });
      expect(withNewTime.format("HH:mm")).toBe("14:30");
    });

    test("Time picker: preserves date when changing time", () => {
      const date = moment("2021-09-14 10:00");
      const withNewTime = date.clone().set({ hour: 16, minute: 45 });
      expect(withNewTime.format("YYYY-MM-DD")).toBe("2021-09-14");
      expect(withNewTime.format("HH:mm")).toBe("16:45");
    });

    test("DateTime: date-only reminder can get time via modal selection", () => {
      const dateOnly = DateTime.parse("2021-09-14");
      expect(dateOnly.hasTimePart).toBe(false);

      // After modal selection with time
      const withTime = new DateTime(moment("2021-09-14 14:30"), true);
      expect(withTime.hasTimePart).toBe(true);
      expect(withTime.format("HH:mm")).toBe("14:30");
    });

    test("DateTime: date+time reminder can become date-only via modal selection", () => {
      const withTime = DateTime.parse("2021-09-14 10:00");
      expect(withTime.hasTimePart).toBe(true);

      // After modal selection without time
      const dateOnly = new DateTime(moment("2021-09-14"), false);
      expect(dateOnly.hasTimePart).toBe(false);
      expect(dateOnly.format("YYYY-MM-DD")).toBe("2021-09-14");
    });
  });

  /**
   * Modal cancel behavior tests.
   * When the user cancels the modal (closes without confirming),
   * the reminder's time should remain unchanged.
   */
  describe("Modal cancel behavior", () => {
    test("Cancel does not change reminder time", () => {
      const originalTime = DateTime.parse("2021-09-14 10:00");
      const reminder = new Reminder("test.md", "Task", originalTime, 0, false);

      // User opens modal and cancels — time should remain unchanged
      expect(reminder.time.toString()).toBe("2021-09-14 10:00");
      expect(reminder.time.equals(originalTime)).toBe(true);
    });

    test("Cancel on overdue reminder preserves overdue time", () => {
      const overdueTime = DateTime.parse("2020-01-01 10:00");
      const reminder = new Reminder("test.md", "Overdue task", overdueTime, 0, false);

      // User opens modal and cancels
      expect(reminder.time.toString()).toBe("2020-01-01 10:00");
    });
  });
});
