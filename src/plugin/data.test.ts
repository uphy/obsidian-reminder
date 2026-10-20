import { Reminders } from "model/reminder";
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
});
