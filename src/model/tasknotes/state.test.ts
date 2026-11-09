import { DateTime } from "model/time";
import { TaskNotesReminderState } from "./state";
import type { TaskNotesReminderStateMap } from "./state";

describe("TaskNotesReminderState", (): void => {
  const trigger = DateTime.parse("2026-11-20 14:30");

  test("invalidates state when the recomputed trigger changes", (): void => {
    const entries: TaskNotesReminderStateMap = {};
    const state = new TaskNotesReminderState(entries);
    state.set("Tasks/Task.md", "reminder-1", trigger, "muted");

    expect(
      state.get(
        "Tasks/Task.md",
        "reminder-1",
        DateTime.parse("2026-11-20 14:31"),
      ),
    ).toBeUndefined();
    expect(entries).toEqual({});
  });

  test("uses a snooze deadline as the effective time", (): void => {
    const state = new TaskNotesReminderState({});
    const until = DateTime.parse("2026-11-21 09:00");
    state.set("Tasks/Task.md", "reminder-1", trigger, "snoozed", until);

    expect(
      state.effectiveTime("Tasks/Task.md", "reminder-1", trigger).toString(),
    ).toBe("2026-11-21 09:00");
  });

  test("migrates state keys when a task note is renamed", (): void => {
    const entries: TaskNotesReminderStateMap = {};
    const state = new TaskNotesReminderState(entries);
    state.set("Tasks/Old.md", "reminder-1", trigger, "done");

    state.migratePath("Tasks/Old.md", "Tasks/New.md");

    expect(state.get("Tasks/New.md", "reminder-1", trigger)?.kind).toBe("done");
    expect(entries["Tasks/Old.md::reminder-1"]).toBeUndefined();
  });

  test("prunes entries whose triggers are outside the flood window", (): void => {
    const entries: TaskNotesReminderStateMap = {
      "Tasks/old.md::old-muted": {
        trigger: DateTime.parse("2026-11-01 09:00").getTimeInMillis(),
        kind: "muted",
      },
      "Tasks/old.md::future-snooze": {
        trigger: DateTime.parse("2026-11-01 09:00").getTimeInMillis(),
        kind: "snoozed",
        until: DateTime.parse("2026-11-21 09:00").getTimeInMillis(),
      },
      "Tasks/old.md::expired-snooze": {
        trigger: DateTime.parse("2026-11-01 09:00").getTimeInMillis(),
        kind: "snoozed",
        until: DateTime.parse("2026-11-15 09:00").getTimeInMillis(),
      },
      "Tasks/recent.md::recent": {
        trigger: DateTime.parse("2026-11-19 09:00").getTimeInMillis(),
        kind: "snoozed",
        until: DateTime.parse("2026-11-20 09:00").getTimeInMillis(),
      },
    };
    const state = new TaskNotesReminderState(entries);

    expect(state.prune(DateTime.parse("2026-11-20 09:00"), 2)).toBe(2);
    expect(Object.keys(entries)).toEqual([
      "Tasks/old.md::future-snooze",
      "Tasks/recent.md::recent",
    ]);
  });

  test("removes state for deleted task notes", (): void => {
    const entries: TaskNotesReminderStateMap = {
      "Tasks/deleted.md::first": { trigger: 1, kind: "done" },
      "Tasks/deleted.md::second": { trigger: 2, kind: "muted" },
      "Tasks/kept.md::first": { trigger: 3, kind: "snoozed" },
    };
    const state = new TaskNotesReminderState(entries);

    expect(state.removeFile("Tasks/deleted.md")).toBe(2);
    expect(Object.keys(entries)).toEqual(["Tasks/kept.md::first"]);
  });
});
