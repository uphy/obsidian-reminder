import { Reminder, Reminders } from "model/reminder";
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

    expect(data.settings.reNotifyMutedOnStartup.value).toBe(false);
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

    expect(data.settings.reNotifyMutedOnStartup.value).toBe(true);
    expect(mutedByTitle(reminders)).toStrictEqual({
      Muted: false,
      "Not muted": false,
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

    expect(data.settings.language.value).toBe("zh-cn");
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

  test("a change made while a save is in flight is written by the next save", async (): Promise<void> => {
    const writes: Array<{ debug?: boolean }> = [];
    let finishWrite: () => void = () => {};
    const store: DataStore = {
      loadData: async () => savedData(),
      saveData: (data) => {
        writes.push(data as { debug?: boolean });
        return new Promise<void>((resolve) => {
          finishWrite = resolve;
        });
      },
    };
    const data = new PluginData(store, new Reminders(() => {}));
    await data.load();

    data.changed = true;
    const firstSave = data.save();
    // Arrives after the first write captured its snapshot.
    data.debug.value = true;
    data.changed = true;
    finishWrite();
    await firstSave;

    expect(data.changed).toBe(true);
    const secondSave = data.save();
    finishWrite();
    await secondSave;

    expect(writes.length).toBe(2);
    expect(writes[1]?.debug).toBe(true);
    expect(data.changed).toBe(false);
  });

  test("a failed save leaves the data flagged as changed", async (): Promise<void> => {
    const store: DataStore = {
      loadData: async () => savedData(),
      saveData: async () => {
        throw new Error("disk full");
      },
    };
    const data = new PluginData(store, new Reminders(() => {}));
    await data.load();
    data.changed = true;

    await expect(data.save()).rejects.toThrow("disk full");

    expect(data.changed).toBe(true);
  });

  test("note reminders are cached apart from line reminders and keep their mute flag", async (): Promise<void> => {
    let saved:
      | {
          reminders: Record<string, Array<{ title: string }>>;
          noteReminders: Record<string, Array<Record<string, unknown>>>;
        }
      | undefined;
    const store: DataStore = {
      loadData: async () => saved,
      saveData: async (data) => {
        saved = data as typeof saved;
      },
    };
    const reminders = new Reminders(() => {});
    const line = Reminder.ofLine(
      "both.md",
      "Line",
      DateTime.parse("2021-09-08 10:00"),
      3,
      false,
    );
    const note = Reminder.ofNote(
      "both.md",
      "both",
      DateTime.parse("2021-09-09"),
      { kind: "note", store: "property", key: "follow-up", label: "follow-up" },
    );
    note.muteNotification = true;
    const noteOnly = Reminder.ofNote(
      "note.md",
      "Send the report",
      DateTime.parse("2021-09-10 09:00"),
      { kind: "note", store: "property", key: "reminder", label: "reminder" },
    );
    reminders.replaceFile("both.md", [line, note]);
    reminders.replaceFile("note.md", [noteOnly]);

    await new PluginData(store, reminders).save(true);

    // An older version reads `reminders` only, and must not find a note
    // reminder there.
    expect(saved?.reminders).toStrictEqual({
      "both.md": [
        { title: "Line", time: "2021-09-08 10:00", rowNumber: 3, muted: false },
      ],
    });
    expect(saved?.noteReminders).toStrictEqual({
      "both.md": [
        {
          title: "both",
          time: "2021-09-09",
          muted: true,
          store: "property",
          key: "follow-up",
          label: "follow-up",
        },
      ],
      "note.md": [
        {
          title: "Send the report",
          time: "2021-09-10 09:00",
          muted: false,
          store: "property",
          key: "reminder",
          label: "reminder",
        },
      ],
    });

    const restored = new Reminders(() => {});
    await new PluginData(store, restored).load();

    expect(
      restored.reminders.map((r) => [
        r.file,
        r.title,
        r.origin.kind,
        r.muteNotification,
      ]),
    ).toStrictEqual([
      ["both.md", "Line", "line", false],
      ["both.md", "both", "note", true],
      ["note.md", "Send the report", "note", false],
    ]);
    expect(restored.fileToReminders.get("both.md")?.length).toBe(2);
  });

  test("the sources setting is read through normalisation and saved as rows", async (): Promise<void> => {
    let saved: { settings: Record<string, unknown> } | undefined;
    const store: DataStore = {
      loadData: async () =>
        savedData({
          noteReminderSources: [
            { property: " follow-up ", managed: true, since: "2026-11-14" },
            "broken",
          ],
        }),
      saveData: async (data) => {
        saved = data as typeof saved;
      },
    };
    const data = new PluginData(store, new Reminders(() => {}));
    expect(data.settings.noteReminderSources.value).toStrictEqual([]);

    await data.load();

    expect(data.settings.noteReminderSources.value).toStrictEqual([
      { property: "follow-up", managed: true, since: "2026-11-14" },
    ]);
    await data.save(true);
    expect(saved?.settings["noteReminderSources"]).toStrictEqual([
      { property: " follow-up ", managed: true, since: "2026-11-14" },
      "broken",
    ]);
  });
});
