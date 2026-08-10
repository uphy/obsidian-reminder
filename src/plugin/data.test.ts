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
