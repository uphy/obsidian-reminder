import moment from "moment";
import { DateTime, Time } from "./time";
import { Reminder, Reminders, groupReminders } from "./reminder";
import type { DateDisplayFormat, GroupedReminder } from "./reminder";

describe("Reminder", (): void => {
  test("extractFileName()", (): void => {
    expect(Reminder.extractFileName("/dir1/dir2/file")).toBe("file");
    expect(Reminder.extractFileName("/dir1/dir2/file.md")).toBe("file");
    expect(Reminder.extractFileName("/dir1/dir2/file.md.zip")).toBe("file");
    expect(Reminder.extractFileName("/dir1/dir2/file.")).toBe("file.");

    expect(Reminder.extractFileName("file.md")).toBe("file");
  });
});

describe("groupReminders()", (): void => {
  const format: DateDisplayFormat = {
    yearMonthFormat: "YYYY, MMMM",
    monthDayFormat: "MM/DD",
    shortDateWithWeekdayFormat: "M/DD (ddd)",
    timeFormat: "HH:mm",
  };
  const reminderTime = Time.parse("09:00");

  function makeReminder(time: DateTime): Reminder {
    return new Reminder("file.md", "title", time, 0, false);
  }

  // `groupReminders` calls `DateTime.now()` internally, so test reminders
  // are constructed relative to the real current time.
  function groupOf(
    groups: Array<GroupedReminder>,
    reminder: Reminder,
  ): GroupedReminder | undefined {
    return groups.find((g) => g.reminders.includes(reminder));
  }

  test("an unmuted reminder whose time is in the past is grouped as Overdue", (): void => {
    const reminder = makeReminder(DateTime.now().add(-1, "hours"));

    const groups = groupReminders([reminder], reminderTime, format);

    const group = groupOf(groups, reminder);
    expect(group?.name).toBe("Overdue");
    expect(group?.isOverdue).toBe(true);
  });

  test("a muted reminder is grouped as Overdue even if its time is in the future", (): void => {
    const reminder = makeReminder(DateTime.now().add(1, "days"));
    reminder.muteNotification = true;

    const groups = groupReminders([reminder], reminderTime, format);

    const group = groupOf(groups, reminder);
    expect(group?.name).toBe("Overdue");
    expect(group?.isOverdue).toBe(true);
  });

  test("an unmuted reminder later today is grouped as Today, not Overdue", (): void => {
    const reminder = makeReminder(DateTime.now().add(1, "minutes"));

    const groups = groupReminders([reminder], reminderTime, format);

    const group = groupOf(groups, reminder);
    expect(group?.name).toBe("Today");
    expect(group?.isOverdue).toBe(false);
  });

  test("a date-only reminder for today is not overdue before the default reminder time", (): void => {
    const reminder = makeReminder(
      DateTime.parse(moment().format("YYYY-MM-DD")),
    );
    // A default time that is still in the future for the current day.
    const futureReminderTime = Time.parse(
      moment().add(1, "minutes").format("HH:mm"),
    );

    const groups = groupReminders([reminder], futureReminderTime, format);

    const group = groupOf(groups, reminder);
    expect(group?.name).toBe("Today");
    expect(group?.isOverdue).toBe(false);
  });

  test("a date-only reminder for a past date is grouped as Overdue", (): void => {
    const reminder = makeReminder(
      DateTime.parse(moment().subtract(1, "days").format("YYYY-MM-DD")),
    );

    const groups = groupReminders([reminder], reminderTime, format);

    const group = groupOf(groups, reminder);
    expect(group?.name).toBe("Overdue");
    expect(group?.isOverdue).toBe(true);
  });
});

describe("Reminders#muteExpiredReminders()", (): void => {
  const reminderTime = Time.parse("09:00");

  function makeReminder(
    title: string,
    time: DateTime,
    muteNotification: boolean = false,
  ): Reminder {
    const reminder = new Reminder("file.md", title, time, 0, false);
    reminder.muteNotification = muteNotification;
    return reminder;
  }

  test("mutes expired reminders and leaves non-expired reminders unmuted", (): void => {
    const reminders = new Reminders(() => {});
    const expired = makeReminder("expired", DateTime.now().add(-1, "hours"));
    const future = makeReminder("future", DateTime.now().add(1, "days"));
    reminders.replaceFile("file.md", [expired, future]);

    const count = reminders.muteExpiredReminders(reminderTime);

    expect(count).toBe(1);
    expect(expired.muteNotification).toBe(true);
    expect(future.muteNotification).toBe(false);
  });

  test("returns only the count of newly muted reminders, not already-muted ones", (): void => {
    const reminders = new Reminders(() => {});
    const alreadyMuted = makeReminder(
      "already-muted",
      DateTime.now().add(-2, "hours"),
      true,
    );
    const newlyMuted = makeReminder(
      "newly-muted",
      DateTime.now().add(-1, "hours"),
    );
    reminders.replaceFile("file.md", [alreadyMuted, newlyMuted]);

    const count = reminders.muteExpiredReminders(reminderTime);

    expect(count).toBe(1);
    expect(alreadyMuted.muteNotification).toBe(true);
    expect(newlyMuted.muteNotification).toBe(true);
  });
});
