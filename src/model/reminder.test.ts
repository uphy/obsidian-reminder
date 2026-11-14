import { moment } from "model/moment";
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

  test("the key of a line reminder is file, title and time run together", (): void => {
    // Saved mute flags are matched by this exact string.
    const reminder = Reminder.ofLine(
      "dir/file.md",
      "Task",
      DateTime.parse("2021-09-08 10:00"),
      3,
      false,
    );
    expect(reminder.key()).toBe("dir/file.mdTask2021-09-08 10:00");
    expect(reminder.row()).toBe(3);
    expect(reminder.isNote()).toBe(false);
  });

  test("the key of a note reminder separates properties and ignores the title", (): void => {
    const time = DateTime.parse("2021-09-08");
    const note = (key: string, title: string): Reminder =>
      Reminder.ofNote("file.md", title, time, {
        kind: "note",
        format: "property",
        key,
        label: key,
      });

    expect(note("a", "title").key()).not.toBe(note("b", "title").key());
    expect(note("a", "title").key()).toBe(note("a", "another").key());
    expect(note("a", "title").row()).toBeUndefined();
    expect(note("a", "title").isNote()).toBe(true);
  });

  test("isDateOnlyNote() is true only for a note reminder with a date", (): void => {
    const note = (time: string): Reminder =>
      Reminder.ofNote("file.md", "title", DateTime.parse(time), {
        kind: "note",
        format: "property",
        key: "due",
        label: "due",
      });
    const line = (time: string): Reminder =>
      Reminder.ofLine("file.md", "title", DateTime.parse(time), 0, false);

    expect(note("2021-09-08").isDateOnlyNote()).toBe(true);
    expect(note("2021-09-08 10:00").isDateOnlyNote()).toBe(false);
    expect(line("2021-09-08").isDateOnlyNote()).toBe(false);
    expect(line("2021-09-08 10:00").isDateOnlyNote()).toBe(false);
  });

  test("equals() tells a line reminder from a note reminder", (): void => {
    const time = DateTime.parse("2021-09-08");
    const line = Reminder.ofLine("file.md", "title", time, 0, false);
    const note = (title: string, label: string): Reminder =>
      Reminder.ofNote("file.md", title, time, {
        kind: "note",
        format: "property",
        key: "a",
        label,
      });

    expect(line.equals(note("title", "a"))).toBe(false);
    expect(note("title", "a").equals(line)).toBe(false);
    expect(note("title", "a").equals(note("title", "a"))).toBe(true);
    expect(note("title", "a").equals(note("changed", "a"))).toBe(false);
    expect(note("title", "a").equals(note("title", "changed"))).toBe(false);
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
    return Reminder.ofLine("file.md", "title", time, 0, false);
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

  test("Overdue timeToString() shows the date only (no time) for a reminder from a previous day", (): void => {
    // The fixture intentionally has a time component to prove it is dropped.
    const reminder = makeReminder(
      DateTime.parse(
        moment().subtract(3, "days").format("YYYY-MM-DD") + " 10:30",
      ),
    );

    const groups = groupReminders([reminder], reminderTime, format);

    const group = groupOf(groups, reminder);
    expect(group?.name).toBe("Overdue");
    expect(group?.timeToString(reminder.time)).toBe(
      moment().subtract(3, "days").format("MM/DD"),
    );
  });

  test("Overdue timeToString() shows only the time for a reminder from earlier today", (): void => {
    const time = DateTime.now().add(-1, "hours");
    const reminder = makeReminder(time);

    const groups = groupReminders([reminder], reminderTime, format);

    const group = groupOf(groups, reminder);
    expect(group?.name).toBe("Overdue");
    // NOTE: like other tests in this suite, this could flake if run exactly
    // at a day boundary between the reminder's construction and this call.
    expect(group?.timeToString(reminder.time)).toBe(time.format("HH:mm"));
  });
});

describe("Reminders#muteExpiredReminders()", (): void => {
  const reminderTime = Time.parse("09:00");

  function makeReminder(
    title: string,
    time: DateTime,
    muteNotification: boolean = false,
  ): Reminder {
    const reminder = Reminder.ofLine("file.md", title, time, 0, false);
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

describe("Reminders#unmute()", (): void => {
  function makeNote(key: string): Reminder {
    return Reminder.ofNote("file.md", "title", DateTime.parse("2021-09-08"), {
      kind: "note",
      format: "property",
      key,
      label: key,
    });
  }

  test("unmutes the stored reminder", (): void => {
    const reminders = new Reminders(() => {});
    const shown = makeNote("remind");
    reminders.replaceFile("file.md", [shown]);
    shown.muteNotification = true;

    reminders.unmute(shown);

    expect(shown.muteNotification).toBe(false);
  });

  test("unmutes the reminder that replaced the given one on a reload", (): void => {
    const reminders = new Reminders(() => {});
    const shown = makeNote("remind");
    reminders.replaceFile("file.md", [shown]);
    shown.muteNotification = true;
    // The note is reloaded with one more reminder while the notification is
    // open: the mute flag moves to a new object with the same key.
    const reloaded = makeNote("remind");
    const other = makeNote("other");
    other.muteNotification = true;
    reminders.replaceFile("file.md", [reloaded, other]);
    expect(reloaded.muteNotification).toBe(true);

    reminders.unmute(shown);

    expect(reloaded.muteNotification).toBe(false);
    expect(shown.muteNotification).toBe(false);
    expect(other.muteNotification).toBe(true);
  });

  test("unmutes the given reminder when its note is no longer stored", (): void => {
    const reminders = new Reminders(() => {});
    const shown = makeNote("remind");
    shown.muteNotification = true;

    reminders.unmute(shown);

    expect(shown.muteNotification).toBe(false);
  });
});

describe("Reminders#replaceFile()", (): void => {
  function makeReminder(title: string, time: string): Reminder {
    return Reminder.ofLine("file.md", title, DateTime.parse(time), 0, false);
  }

  test("an equal list reports no change and keeps the mute flag", (): void => {
    const reminders = new Reminders(() => {});
    const original = makeReminder("task", "2021-09-08 10:00");
    reminders.replaceFile("file.md", [original]);
    original.muteNotification = true;

    const changed = reminders.replaceFile("file.md", [
      makeReminder("task", "2021-09-08 10:00"),
    ]);

    expect(changed).toBe(false);
    expect(reminders.reminders[0]?.muteNotification).toBe(true);
  });

  test("a reminder that comes back with the same key stays muted", (): void => {
    const reminders = new Reminders(() => {});
    const original = makeReminder("task", "2021-09-08 10:00");
    reminders.replaceFile("file.md", [original]);
    original.muteNotification = true;

    const changed = reminders.replaceFile("file.md", [
      makeReminder("task", "2021-09-08 10:00"),
      makeReminder("another", "2021-09-09 10:00"),
    ]);

    expect(changed).toBe(true);
    const byTitle = new Map(
      reminders.reminders.map((r) => [r.title, r.muteNotification]),
    );
    expect(byTitle.get("task")).toBe(true);
    expect(byTitle.get("another")).toBe(false);
  });

  test("a reminder whose time changed is not muted", (): void => {
    const reminders = new Reminders(() => {});
    const original = makeReminder("task", "2021-09-08 10:00");
    reminders.replaceFile("file.md", [original]);
    original.muteNotification = true;

    reminders.replaceFile("file.md", [
      makeReminder("task", "2021-09-08 11:00"),
    ]);

    expect(reminders.reminders[0]?.muteNotification).toBe(false);
  });
});
