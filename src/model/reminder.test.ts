import { moment } from "model/moment";
import { DateTime, Time } from "./time";
import { Reminder, Reminders, groupReminders } from "./reminder";
import type { DateDisplayFormat, GroupedReminder } from "./reminder";

describe("Reminder", (): void => {
  test("key() keeps the exact markdown reminder key format", (): void => {
    const reminder = new Reminder(
      "folder/note.md",
      "Review the proposal",
      DateTime.parse("2026-11-09 08:15"),
      2,
      false,
    );

    expect(reminder.key()).toBe(
      "folder/note.mdReview the proposal2026-11-09 08:15",
    );
  });

  test("TaskNotes keys include source and reminder id", (): void => {
    const reminder = new Reminder(
      "Tasks/Task.md",
      "Description",
      DateTime.parse("2026-11-20 09:00"),
      -1,
      false,
      "tasknotes",
      {
        reminderId: "reminder-1",
        anchor: { type: "due", time: DateTime.parse("2026-11-20 09:00") },
        taskTitle: "Task",
      },
    );

    expect(reminder.key()).toBe("Tasks/Task.md::tasknotes::reminder-1");
  });

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

describe("Reminders source-scoped replacement", (): void => {
  test("bulk replacement matches sequential replacement and notifies once", (): void => {
    const makeTaskNotesReminder = (
      file: string,
      reminderId: string,
      time: string,
      muted: boolean = false,
    ): Reminder => {
      const reminder = new Reminder(
        file,
        reminderId,
        DateTime.parse(time),
        -1,
        false,
        "tasknotes",
        {
          reminderId,
          anchor: { type: "due", time: DateTime.parse(time) },
          taskTitle: file,
        },
      );
      reminder.muteNotification = muted;
      return reminder;
    };
    const seed = (reminders: Reminders): void => {
      reminders.replaceSourceFile("a.md", "tasknotes", [
        makeTaskNotesReminder("a.md", "keep-muted", "2026-11-20 09:00", true),
      ]);
      reminders.replaceSourceFile("b.md", "tasknotes", [
        makeTaskNotesReminder("b.md", "remove", "2026-11-21 09:00"),
      ]);
      reminders.replaceSourceFile("c.md", "tasknotes", [
        makeTaskNotesReminder("c.md", "stale", "2026-11-22 09:00"),
      ]);
      reminders.replaceSourceFile("a.md", "markdown", [
        new Reminder(
          "a.md",
          "Markdown reminder",
          DateTime.parse("2026-11-20 08:00"),
          0,
          false,
        ),
      ]);
    };
    const bulkOnChange = jest.fn();
    const bulk = new Reminders(bulkOnChange);
    seed(bulk);
    bulkOnChange.mockClear();

    const bulkFiles = new Map<string, Array<Reminder>>([
      [
        "a.md",
        [
          makeTaskNotesReminder("a.md", "keep-muted", "2026-11-20 09:00"),
          makeTaskNotesReminder("a.md", "new", "2026-11-20 10:00"),
        ],
      ],
      [
        "b.md",
        [makeTaskNotesReminder("b.md", "replacement", "2026-11-21 11:00")],
      ],
    ]);

    expect(bulk.replaceSourceFiles("tasknotes", bulkFiles)).toBe(true);
    expect(bulkOnChange).toHaveBeenCalledTimes(1);

    const sequential = new Reminders(() => {});
    seed(sequential);
    sequential.replaceSourceFile("a.md", "tasknotes", bulkFiles.get("a.md")!);
    sequential.replaceSourceFile("b.md", "tasknotes", bulkFiles.get("b.md")!);
    sequential.replaceSourceFile("c.md", "tasknotes", []);

    const summarize = (reminders: Reminders) =>
      reminders.reminders.map((reminder) => ({
        file: reminder.file,
        key: reminder.key(),
        muted: reminder.muteNotification,
      }));
    expect(summarize(bulk)).toEqual(summarize(sequential));
    expect(
      bulk.fileToReminders
        .get("a.md")
        ?.find((reminder) => reminder.source === "markdown")?.title,
    ).toBe("Markdown reminder");
    expect(
      bulk.reminders.find((reminder) => reminder.key().includes("keep-muted"))
        ?.muteNotification,
    ).toBe(true);
  });

  test("replacing one source keeps the other source in the same file", (): void => {
    const reminders = new Reminders(() => {});
    const markdown = new Reminder(
      "Tasks/Task.md",
      "Markdown reminder",
      DateTime.parse("2026-11-20 09:00"),
      0,
      false,
    );
    const tasknotes = new Reminder(
      "Tasks/Task.md",
      "TaskNotes reminder",
      DateTime.parse("2026-11-20 10:00"),
      -1,
      false,
      "tasknotes",
      {
        reminderId: "tasknotes-1",
        anchor: { type: "due", time: DateTime.parse("2026-11-20 10:00") },
        taskTitle: "Task",
      },
    );

    reminders.replaceSourceFile("Tasks/Task.md", "markdown", [markdown]);
    reminders.replaceSourceFile("Tasks/Task.md", "tasknotes", [tasknotes]);
    const reparsedMarkdown = new Reminder(
      "Tasks/Task.md",
      "Updated markdown reminder",
      DateTime.parse("2026-11-20 09:30"),
      0,
      false,
    );
    reminders.replaceSourceFile("Tasks/Task.md", "markdown", [
      reparsedMarkdown,
    ]);

    expect(reminders.reminders).toEqual([reparsedMarkdown, tasknotes]);

    reminders.replaceSourceFile("Tasks/Task.md", "tasknotes", []);

    expect(reminders.reminders).toEqual([reparsedMarkdown]);
    expect(reminders.fileToReminders.get("Tasks/Task.md")).toEqual([
      reparsedMarkdown,
    ]);
  });

  test("uses a TaskNotes snooze deadline when checking expiry and sorting", (): void => {
    const reminders = new Reminders(() => {});
    const tasknotes = new Reminder(
      "Tasks/Task.md",
      "TaskNotes reminder",
      DateTime.now().add(-1, "days"),
      -1,
      false,
      "tasknotes",
      {
        reminderId: "tasknotes-snooze",
        anchor: { type: "due", time: DateTime.now().add(-1, "days") },
        taskTitle: "Task",
      },
    );
    tasknotes.effectiveTime = DateTime.now().add(1, "days");
    reminders.replaceSourceFile("Tasks/Task.md", "tasknotes", [tasknotes]);

    expect(reminders.getExpiredReminders(Time.parse("09:00"))).toHaveLength(0);
    expect(reminders.reminders[0]?.effectiveTime).toBe(tasknotes.effectiveTime);
  });
});
