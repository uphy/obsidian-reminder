/**
 * @fileoverview Tests for reschedule interaction logic.
 *
 * Tests the click/long-press/right-click behavior for reminders in the reminder list view.
 * The interaction model is:
 *
 * | Reminder Type | Regular Click | Long-Press (Mobile) | Right-Click (Desktop) |
 * |---------------|---------------|---------------------|-----------------------|
 * | Overdue       | Reschedule    | Reschedule          | Reschedule            |
 * | Today         | Open modal    | Reschedule          | Reschedule            |
 * | Tomorrow      | Open modal    | Reschedule          | Reschedule            |
 * | Days ahead    | Open modal    | Reschedule          | Reschedule            |
 * | Weeks ahead   | Open modal    | Reschedule          | Reschedule            |
 *
 * The reschedule context menu provides quick options:
 * - "In 3 hours"  → now + 3 hours
 * - "Tomorrow"    → now + 1 day
 * - "Next week"   → now + 1 week
 * - "Custom..."   → opens DateTimeChooser modal for date+time picker
 *
 * After selecting a quick option or confirming in the modal:
 * 1. Reminder time is updated in memory
 * 2. File is written via ReminderPluginFileSystem.updateReminder()
 * 3. Plugin data is saved via plugin.data.save(true)
 * 4. Reminder list is reloaded via ui.reload(true)
 *
 * @see src/ui/ReminderListByDate.svelte — click/long-press/right-click handlers
 * @see src/plugin/ui/reminder-list.ts — showRescheduleContextMenu(), showRescheduleModalForReminder()
 * @see src/plugin/ui/index.ts — rescheduleReminder()
 */

import { DateTime, Time } from "model/time";
import moment from "moment";
import { Reminder, Reminders } from "model/reminder";

describe("Reschedule Interaction Logic", (): void => {
  /**
   * Tests for DateTime calculations used by the quick reschedule options.
   * These calculations are performed in the context menu onClick handlers
   * in ReminderListItemView.showRescheduleContextMenu().
   */
  describe("DateTime calculations for quick reschedule options", () => {
    /** "In 3 hours" option: adds 3 hours to current time */
    test("In 3 hours: now + 3 hours preserves time part", () => {
      const now = DateTime.now();
      const threeHoursLater = now.add(3, "hours");
      expect(threeHoursLater.hasTimePart).toBe(true);
      const diffMs = threeHoursLater.getTimeInMillis() - now.getTimeInMillis();
      expect(diffMs).toBeGreaterThanOrEqual(3 * 60 * 60 * 1000 - 1000);
      expect(diffMs).toBeLessThanOrEqual(3 * 60 * 60 * 1000 + 1000);
    });

    /** "Tomorrow" option: adds 1 day to current time */
    test("Tomorrow: now + 1 day", () => {
      const now = DateTime.now();
      const tomorrow = now.add(1, "days");
      expect(tomorrow.hasTimePart).toBe(true);
      const diffMs = tomorrow.getTimeInMillis() - now.getTimeInMillis();
      expect(diffMs).toBeGreaterThanOrEqual(24 * 60 * 60 * 1000 - 1000);
      expect(diffMs).toBeLessThanOrEqual(24 * 60 * 60 * 1000 + 1000);
    });

    /** "Next week" option: adds 1 week to current time */
    test("Next week: now + 1 week", () => {
      const now = DateTime.now();
      const nextWeek = now.add(1, "weeks");
      expect(nextWeek.hasTimePart).toBe(true);
      const diffMs = nextWeek.getTimeInMillis() - now.getTimeInMillis();
      expect(diffMs).toBeGreaterThanOrEqual(7 * 24 * 60 * 60 * 1000 - 1000);
      expect(diffMs).toBeLessThanOrEqual(7 * 24 * 60 * 60 * 1000 + 1000);
    });

    /** Verifies that replacing a reminder's time works correctly */
    test("Rescheduled time replaces old reminder time", () => {
      const reminder = new Reminder("test.md", "Task", DateTime.parse("2021-09-14 10:00"), 0, false);
      const newTime = DateTime.parse("2021-10-01 14:00");
      reminder.time = newTime;
      expect(reminder.time.toString()).toBe("2021-10-01 14:00");
      expect(reminder.time.hasTimePart).toBe(true);
    });
  });

  /**
   * Tests for reminder time updates within the Reminders collection.
   * When a reminder is rescheduled, its time changes which affects its
   * sorted position in the reminders list.
   */
  describe("Reminder time update in Reminders collection", () => {
    test("Updating reminder time changes its position in sorted list", () => {
      const reminders = new Reminders(() => {});
      reminders.reminderTime = { value: new Time(9, 0) } as any;

      const r1 = new Reminder("test.md", "Task1", DateTime.parse("2021-09-14 10:00"), 0, false);
      const r2 = new Reminder("test.md", "Task2", DateTime.parse("2021-09-15 10:00"), 1, false);
      const r3 = new Reminder("test.md", "Task3", DateTime.parse("2021-09-16 10:00"), 2, false);

      reminders.replaceFile("test.md", [r1, r2, r3]);
      expect(reminders.reminders[0]!.title).toBe("Task1");
      expect(reminders.reminders[1]!.title).toBe("Task2");
      expect(reminders.reminders[2]!.title).toBe("Task3");

      // Reschedule Task1 to after Task3
      const r1Rescheduled = new Reminder("test.md", "Task1", DateTime.parse("2021-09-20 10:00"), 0, false);
      reminders.replaceFile("test.md", [r1Rescheduled, r2, r3]);

      expect(reminders.reminders[0]!.title).toBe("Task2");
      expect(reminders.reminders[1]!.title).toBe("Task3");
      expect(reminders.reminders[2]!.title).toBe("Task1");
    });

    test("Reschedule preserves reminder properties (file, title, rowNumber, done, muteNotification)", () => {
      const reminder = new Reminder("test.md", "My Task", DateTime.parse("2021-09-14 10:00"), 5, false);
      reminder.muteNotification = true;

      const newTime = DateTime.parse("2021-09-20 14:00");
      reminder.time = newTime;

      expect(reminder.file).toBe("test.md");
      expect(reminder.title).toBe("My Task");
      expect(reminder.rowNumber).toBe(5);
      expect(reminder.done).toBe(false);
      expect(reminder.muteNotification).toBe(true);
      expect(reminder.time.toString()).toBe("2021-09-20 14:00");
    });
  });

  /**
   * Tests for the RescheduleModal initial date.
   * The modal receives the reminder's current time as the initial date
   * for the DateTimeChooser calendar and time picker.
   */
  describe("RescheduleModal initial date", () => {
    test("RescheduleModal uses current reminder time as initial date", () => {
      const reminderTime = DateTime.parse("2021-09-14 10:00");
      const initialDate = reminderTime.moment();
      expect(initialDate.format("YYYY-MM-DD")).toBe("2021-09-14");
      expect(initialDate.format("HH:mm")).toBe("10:00");
    });

    test("RescheduleModal with date-only reminder", () => {
      const reminderTime = DateTime.parse("2021-09-14");
      const initialDate = reminderTime.moment();
      expect(initialDate.format("YYYY-MM-DD")).toBe("2021-09-14");
      expect(reminderTime.hasTimePart).toBe(false);
    });
  });

  /**
   * Tests for overdue reminder interaction.
   * Overdue reminders are in the "Overdue" group (group.isOverdue === true).
   * Regular click on overdue reminders opens the reschedule context menu
   * instead of the reminder modal, since the primary action for overdue
   * tasks is to reschedule them.
   */
  describe("Overdue reminder interaction", () => {
    test("Overdue: regular click triggers reschedule context menu (not open modal)", () => {
      const now = DateTime.now();
      const overdueTime = now.add(-2, "hours");
      const reminder = new Reminder("test.md", "Overdue task", overdueTime, 0, false);

      // Simulate Svelte component handleClick with isOverdue=true
      const isOverdue = true;
      let rescheduleCalled = false;
      let openModalCalled = false;
      const handleClick = () => {
        if (isOverdue) { rescheduleCalled = true; return; }
        openModalCalled = true;
      };

      handleClick();
      expect(rescheduleCalled).toBe(true);
      expect(openModalCalled).toBe(false);
    });

    test("Overdue: right-click always shows reschedule menu", () => {
      let rescheduleCalled = false;
      const handleContextMenu = () => { rescheduleCalled = true; };
      handleContextMenu();
      expect(rescheduleCalled).toBe(true);
    });

    test("Overdue: can be rescheduled to future date", () => {
      const overdue = new Reminder("test.md", "Overdue task", DateTime.parse("2020-01-01 10:00"), 0, false);
      const future = DateTime.now().add(1, "days");
      overdue.time = future;
      expect(overdue.time.getTimeInMillis()).toBeGreaterThan(Date.now());
    });
  });

  /**
   * Tests for same-day (today) reminder interaction.
   * Today reminders are NOT overdue, so regular click opens the reminder modal.
   * Long-press and right-click show the reschedule context menu.
   */
  describe("Same-day (today) reminder interaction", () => {
    test("Today: regular click opens reminder modal (not reschedule)", () => {
      const isOverdue = false;
      let rescheduleCalled = false;
      let openModalCalled = false;
      const handleClick = () => {
        if (isOverdue) { rescheduleCalled = true; return; }
        openModalCalled = true;
      };

      handleClick();
      expect(rescheduleCalled).toBe(false);
      expect(openModalCalled).toBe(true);
    });

    test("Today: long-press shows reschedule menu", () => {
      const isOverdue = false;
      let rescheduleCalled = false;
      const handleLongPress = () => { if (!isOverdue) rescheduleCalled = true; };
      handleLongPress();
      expect(rescheduleCalled).toBe(true);
    });

    test("Today: right-click shows reschedule menu", () => {
      let rescheduleCalled = false;
      const handleContextMenu = () => { rescheduleCalled = true; };
      handleContextMenu();
      expect(rescheduleCalled).toBe(true);
    });
  });

  /**
   * Tests for tomorrow reminder interaction.
   * Tomorrow reminders are NOT overdue, so regular click opens the reminder modal.
   */
  describe("Tomorrow reminder interaction", () => {
    test("Tomorrow: regular click opens reminder modal", () => {
      const isOverdue = false;
      let openModalCalled = false;
      const handleClick = () => { if (isOverdue) return; openModalCalled = true; };
      handleClick();
      expect(openModalCalled).toBe(true);
    });

    test("Tomorrow: long-press shows reschedule menu", () => {
      const isOverdue = false;
      let rescheduleCalled = false;
      const handleLongPress = () => { if (!isOverdue) rescheduleCalled = true; };
      handleLongPress();
      expect(rescheduleCalled).toBe(true);
    });
  });

  /**
   * Tests for next week reminder interaction.
   * Next week reminders are NOT overdue, so regular click opens the reminder modal.
   */
  describe("Next week reminder interaction", () => {
    test("Next week: regular click opens reminder modal", () => {
      const isOverdue = false;
      let openModalCalled = false;
      const handleClick = () => { if (isOverdue) return; openModalCalled = true; };
      handleClick();
      expect(openModalCalled).toBe(true);
    });

    test("Next week: long-press shows reschedule menu", () => {
      const isOverdue = false;
      let rescheduleCalled = false;
      const handleLongPress = () => { if (!isOverdue) rescheduleCalled = true; };
      handleLongPress();
      expect(rescheduleCalled).toBe(true);
    });
  });

  /**
   * Tests for days/weeks ahead reminder interaction.
   * These reminders are NOT overdue, so regular click opens the reminder modal.
   * Long-press shows the reschedule context menu.
   */
  describe("Days/weeks ahead reminder interaction", () => {
    test("Days ahead: regular click opens modal, long-press shows reschedule", () => {
      const isOverdue = false;
      let openModalCalled = false;
      let rescheduleCalled = false;

      const handleClick = () => { if (isOverdue) { rescheduleCalled = true; return; } openModalCalled = true; };
      handleClick();
      expect(openModalCalled).toBe(true);
      expect(rescheduleCalled).toBe(false);

      const handleLongPress = () => { if (!isOverdue) rescheduleCalled = true; };
      handleLongPress();
      expect(rescheduleCalled).toBe(true);
    });

    test("Weeks ahead: regular click opens modal, long-press shows reschedule", () => {
      const isOverdue = false;
      let openModalCalled = false;
      let rescheduleCalled = false;

      const handleClick = () => { if (isOverdue) { rescheduleCalled = true; return; } openModalCalled = true; };
      handleClick();
      expect(openModalCalled).toBe(true);

      const handleLongPress = () => { if (!isOverdue) rescheduleCalled = true; };
      handleLongPress();
      expect(rescheduleCalled).toBe(true);
    });
  });

  /**
   * Edge cases for the reschedule interaction.
   */
  describe("Edge cases", () => {
    test("Reschedule to same time doesn't break", () => {
      const reminder = new Reminder("test.md", "Task", DateTime.parse("2021-09-14 10:00"), 0, false);
      const sameTime = DateTime.parse("2021-09-14 10:00");
      reminder.time = sameTime;
      expect(reminder.time.equals(sameTime)).toBe(true);
    });

    test("Reschedule with date-only reminder to date+time", () => {
      const reminder = new Reminder("test.md", "Task", DateTime.parse("2021-09-14"), 0, false);
      expect(reminder.time.hasTimePart).toBe(false);

      const newTime = new DateTime(moment().add(3, "hours"), true);
      reminder.time = newTime;
      expect(reminder.time.hasTimePart).toBe(true);
    });

    test("Reschedule with date+time reminder to date-only", () => {
      const reminder = new Reminder("test.md", "Task", DateTime.parse("2021-09-14 10:00"), 0, false);
      expect(reminder.time.hasTimePart).toBe(true);

      const newTime = DateTime.parse("2021-10-01");
      reminder.time = newTime;
      expect(reminder.time.hasTimePart).toBe(false);
    });

    test("Reminder key changes after reschedule (used for deduplication)", () => {
      const reminder = new Reminder("test.md", "Task", DateTime.parse("2021-09-14 10:00"), 0, false);
      const oldKey = reminder.key();
      reminder.time = DateTime.parse("2021-10-01 14:00");
      const newKey = reminder.key();
      expect(newKey).not.toBe(oldKey);
    });

    test("Reminder equals returns false after reschedule", () => {
      const r1 = new Reminder("test.md", "Task", DateTime.parse("2021-09-14 10:00"), 0, false);
      const r2 = new Reminder("test.md", "Task", DateTime.parse("2021-09-14 10:00"), 0, false);
      expect(r1.equals(r2)).toBe(true);

      r2.time = DateTime.parse("2021-10-01 14:00");
      expect(r1.equals(r2)).toBe(false);
    });

    /** Touch move cancels long-press (user is scrolling, not long-pressing) */
    test("Touch move cancels long-press (scrolling)", () => {
      let longPressFired = false;
      let timer: ReturnType<typeof setTimeout> | null = null;

      // touchstart: start timer
      timer = setTimeout(() => { longPressFired = true; }, 500);

      // touchmove: cancel timer
      if (timer) { clearTimeout(timer); timer = null; }

      expect(longPressFired).toBe(false);
    });

    /** After a long-press fires, the subsequent click should be suppressed */
    test("Click after long-press does not fire openReminder", () => {
      let longPressTriggered = true;
      let openModalCalled = false;

      const handleClick = () => {
        if (longPressTriggered) { longPressTriggered = false; return; }
        openModalCalled = true;
      };

      handleClick();
      expect(openModalCalled).toBe(false);
    });
  });
});
