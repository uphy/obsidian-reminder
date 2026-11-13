import { Reminder } from "model/reminder";
import { Reminders } from "model/reminders";
import { DateTime } from "model/time";
import { getLanguage, getLanguageSetting, setLanguage } from "i18n";
import { PluginData } from "./data";
import type { DataStore } from "./data";

function createStore(data: unknown): DataStore {
  return {
    loadData: async () => data,
    saveData: async () => {},
  };
}

function savedData(settings: Record<string, unknown> = {}) {
  return {
    scanned: true,
    settings,
    reminders: {
      "file.md": [
        { title: "Muted", time: "2021-09-08", rowNumber: 0, muted: true },
        { title: "Not muted", time: "2021-09-09", rowNumber: 1, muted: false },
      ],
    },
  };
}

function mutedByTitle(reminders: Reminders): Record<string, boolean> {
  const result: Record<string, boolean> = {};
  for (const reminder of reminders.reminders) {
    result[reminder.title] = reminder.muteNotification;
  }
  return result;
}

describe("PluginData", (): void => {
  // The language is module-global state in `i18n`, and these tests load
  // persisted values into it, so it has to be reset between cases.
  afterEach((): void => {
    setLanguage("en");
    window.localStorage.clear();
  });

  test("restores persisted mute flags by default", async (): Promise<void> => {
    const reminders = new Reminders(() => {});
    const data = new PluginData(createStore(savedData()), reminders);

    await data.load();

    expect(data.settings.notifications.reNotifyMutedOnStartup.value).toBe(
      false,
    );
    expect(mutedByTitle(reminders)).toStrictEqual({
      Muted: true,
      "Not muted": false,
    });
  });

  test("drops persisted mute flags when re-notification on startup is enabled", async (): Promise<void> => {
    const reminders = new Reminders(() => {});
    const data = new PluginData(
      createStore(savedData({ reNotifyMutedOnStartup: true })),
      reminders,
    );

    await data.load();

    expect(data.settings.notifications.reNotifyMutedOnStartup.value).toBe(true);
    expect(mutedByTitle(reminders)).toStrictEqual({
      Muted: false,
      "Not muted": false,
    });
  });

  test("restores persisted markdown reminders without replacing TaskNotes reminders for the same file", async (): Promise<void> => {
    const reminders = new Reminders(() => {});
    const taskNotesReminder = new Reminder(
      "file.md",
      "TaskNotes reminder",
      DateTime.parse("2026-11-20 09:00"),
      -1,
      false,
      "tasknotes",
      {
        reminderId: "tasknotes-reminder",
        anchor: { type: "due", time: DateTime.parse("2026-11-20 09:00") },
        taskTitle: "Task",
      },
    );
    reminders.replaceSourceFile("file.md", "tasknotes", [taskNotesReminder]);

    const data = new PluginData(createStore(savedData()), reminders);
    await data.load();

    expect(
      reminders.fileToReminders
        .get("file.md")
        ?.map((reminder) => reminder.source),
    ).toEqual(["tasknotes", "markdown", "markdown"]);
  });

  test("defaults and persists TaskNotes state without serializing TaskNotes reminders as markdown", async (): Promise<void> => {
    let saved: Record<string, unknown> | undefined;
    const store: DataStore = {
      loadData: async () => savedData(),
      saveData: async (data) => {
        saved = data as Record<string, unknown>;
      },
    };
    const reminders = new Reminders(() => {});
    const data = new PluginData(store, reminders);
    await data.load();
    expect(data.taskNotesReminderState).toEqual({});

    reminders.replaceSourceFile("Tasks/Task.md", "tasknotes", [
      new Reminder(
        "Tasks/Task.md",
        "Reminder",
        DateTime.parse("2026-11-20 09:00"),
        -1,
        false,
        "tasknotes",
        {
          reminderId: "persisted-state",
          anchor: { type: "due", time: DateTime.parse("2026-11-20 09:00") },
          taskTitle: "Task",
        },
      ),
    ]);
    data.taskNotesReminderState["Tasks/Task.md::persisted-state"] = {
      trigger: DateTime.parse("2026-11-20 09:00").getTimeInMillis(),
      kind: "muted",
    };

    await data.save(true);

    expect(saved?.["taskNotesReminderState"]).toEqual(
      data.taskNotesReminderState,
    );
    expect(saved?.["reminders"]).toEqual({
      "file.md": [
        { title: "Muted", time: "2021-09-08", rowNumber: 0, muted: true },
        {
          title: "Not muted",
          time: "2021-09-09",
          rowNumber: 1,
          muted: false,
        },
      ],
    });
  });

  test("a changed Tasks-plugin seed forces a rescan; an unchanged one does not", async (): Promise<void> => {
    const reminders = new Reminders(() => {});
    let saved: { scanned: boolean; seededTaskStatuses?: string } | undefined;
    const store: DataStore = {
      loadData: async () => ({
        ...savedData(),
        seededTaskStatuses: "[ ] -> [x] TODO",
      }),
      saveData: async (data) => {
        saved = data as typeof saved;
      },
    };
    const data = new PluginData(store, reminders);
    await data.load();
    expect(data.scanned.value).toBe(true);

    // Same seed as last session: stored reminders are still valid.
    data.updateSeededTaskStatuses("[ ] -> [x] TODO");
    expect(data.scanned.value).toBe(true);

    // The Tasks plugin's statuses changed since last session: everything in
    // data.json was classified under the old ones, so a rescan is due.
    data.updateSeededTaskStatuses("[ ] -> [x] TODO\n[v] -> [ ] DONE");
    expect(data.scanned.value).toBe(false);

    await data.save(true);
    expect(saved?.seededTaskStatuses).toBe("[ ] -> [x] TODO\n[v] -> [ ] DONE");
  });

  test("resolves `loaded` once load() has finished", async (): Promise<void> => {
    const reminders = new Reminders(() => {});
    const data = new PluginData(createStore(savedData()), reminders);
    let resolved = false;
    void data.loaded.then(() => {
      resolved = true;
    });

    await Promise.resolve();
    expect(resolved).toBe(false);

    await data.load();
    await data.loaded;

    expect(resolved).toBe(true);
  });

  test("resolves `loaded` even when loading fails", async (): Promise<void> => {
    const reminders = new Reminders(() => {});
    const data = new PluginData(
      {
        loadData: async () => {
          throw new Error("boom");
        },
        saveData: async () => {},
      },
      reminders,
    );

    await expect(data.load()).rejects.toThrow("boom");

    await expect(data.loaded).resolves.toBeUndefined();
  });

  test("applies a persisted language while restoring", async (): Promise<void> => {
    const data = new PluginData(
      createStore(savedData({ language: "zh-cn" })),
      new Reminders(() => {}),
    );

    await data.load();

    expect(data.settings.display.language.value).toBe("zh-cn");
    expect(getLanguage()).toBe("zh-cn");
  });

  test("falls back to auto for a persisted language it does not ship", async (): Promise<void> => {
    const data = new PluginData(
      createStore(savedData({ language: "klingon" })),
      new Reminders(() => {}),
    );

    await data.load();

    expect(getLanguageSetting()).toBe("auto");
    expect(getLanguage()).toBe("en");
  });
});
