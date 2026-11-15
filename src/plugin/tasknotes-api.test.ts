import { TaskNotesApi } from "./tasknotes-api";

type Call = { path: string; reminders: unknown; context: unknown };

function apiOf(overrides: Record<string, unknown> = {}) {
  const calls: Array<Call> = [];
  const api = {
    apiVersion: 1,
    hasCapability: (capability: string) =>
      capability === "settings.snapshot" || capability === "tasks.write",
    settings: { snapshot: () => ({ taskTag: "from-api" }) },
    tasks: {
      setReminders: async (
        path: string,
        reminders: unknown,
        context: unknown,
      ): Promise<void> => {
        calls.push({ path, reminders, context });
      },
    },
    ...overrides,
  };
  return { api, calls };
}

const FIELD = { taskTag: "from-field" };

function settingsOf(plugin: unknown): unknown {
  return new TaskNotesApi(() => plugin).settings();
}

describe("TaskNotesApi#settings()", (): void => {
  test("no plugin means no settings", (): void => {
    expect(settingsOf(undefined)).toBeUndefined();
    expect(settingsOf("tasknotes")).toBeUndefined();
    expect(settingsOf({})).toBeUndefined();
  });

  test("the API's snapshot is preferred", (): void => {
    expect(settingsOf({ api: apiOf().api, settings: FIELD })).toStrictEqual({
      taskTag: "from-api",
    });
  });

  test("without a usable API, the settings field is read", (): void => {
    const cases: Array<unknown> = [
      undefined,
      apiOf({ apiVersion: 2 }).api,
      apiOf({ hasCapability: () => false }).api,
      apiOf({ hasCapability: undefined }).api,
      apiOf({ settings: {} }).api,
      apiOf({ settings: { snapshot: () => "broken" } }).api,
      apiOf({ settings: { snapshot: async () => ({ taskTag: "later" }) } }).api,
    ];
    for (const value of cases) {
      expect(settingsOf({ api: value, settings: FIELD })).toBe(FIELD);
    }
  });

  test("an API that throws falls back to the settings field", (): void => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const { api } = apiOf({
        settings: {
          snapshot: () => {
            throw new Error("not ready");
          },
        },
      });
      expect(settingsOf({ api, settings: FIELD })).toBe(FIELD);
      expect(warn).toHaveBeenCalledTimes(1);
    } finally {
      warn.mockRestore();
    }
  });

  test("the plugin is looked up on every call", (): void => {
    let plugin: unknown = undefined;
    const taskNotes = new TaskNotesApi(() => plugin);
    expect(taskNotes.settings()).toBeUndefined();
    plugin = { settings: FIELD };
    expect(taskNotes.settings()).toBe(FIELD);
  });
});

describe("TaskNotesApi#setReminders()", (): void => {
  const REMINDERS = [{ id: "rem_1", type: "absolute" }];

  test("hands the list to TaskNotes, naming this plugin", async (): Promise<void> => {
    const { api, calls } = apiOf();
    const taskNotes = new TaskNotesApi(() => ({ api }));
    expect(await taskNotes.setReminders("Tasks/a.md", REMINDERS)).toBe(true);
    expect(calls).toStrictEqual([
      {
        path: "Tasks/a.md",
        reminders: REMINDERS,
        context: { source: "obsidian-reminder" },
      },
    ]);
  });

  test("is not taken without a usable API", async (): Promise<void> => {
    const cases: Array<unknown> = [
      undefined,
      {},
      { api: apiOf({ apiVersion: 2 }).api },
      { api: apiOf({ hasCapability: () => false }).api },
      { api: apiOf({ tasks: undefined }).api },
      { api: apiOf({ tasks: {} }).api },
    ];
    for (const plugin of cases) {
      const taskNotes = new TaskNotesApi(() => plugin);
      expect(await taskNotes.setReminders("Tasks/a.md", REMINDERS)).toBe(false);
    }
  });

  test("checks the capability for writing tasks", async (): Promise<void> => {
    const { api, calls } = apiOf({
      hasCapability: (capability: string) => capability === "settings.snapshot",
    });
    const taskNotes = new TaskNotesApi(() => ({ api }));
    expect(await taskNotes.setReminders("Tasks/a.md", REMINDERS)).toBe(false);
    expect(calls).toHaveLength(0);
  });

  test("a value that is not a list is not handed over", async (): Promise<void> => {
    const { api, calls } = apiOf();
    const taskNotes = new TaskNotesApi(() => ({ api }));
    expect(await taskNotes.setReminders("Tasks/a.md", undefined)).toBe(false);
    expect(calls).toHaveLength(0);
  });

  test("a write TaskNotes rejects is not taken", async (): Promise<void> => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const { api } = apiOf({
        tasks: {
          setReminders: async (): Promise<void> => {
            throw new Error("task_not_found");
          },
        },
      });
      const taskNotes = new TaskNotesApi(() => ({ api }));
      expect(await taskNotes.setReminders("Tasks/a.md", REMINDERS)).toBe(false);
      expect(warn).toHaveBeenCalledTimes(1);
    } finally {
      warn.mockRestore();
    }
  });
});
