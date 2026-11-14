import {
  DEFAULT_TASKNOTES_SETTINGS,
  exportTaskNotesSettings,
  importTaskNotesSettings,
  resolveTaskNotesSettings,
  taskNotesDefaults,
} from "./tasknotes-settings";
import type {
  ImportedTaskNotesSettings,
  TaskNotesOverrides,
} from "./tasknotes-settings";

const RENAMED: ImportedTaskNotesSettings = {
  identification: "property",
  taskTag: "todo",
  taskProperty: "type",
  taskPropertyValue: "task",
  completedStatuses: ["finished", "cancelled"],
  archiveTag: "shelved",
  properties: {
    title: "name",
    status: "state",
    due: "deadline",
    scheduled: "start",
    reminders: "alerts",
    recurrence: "repeat",
  },
};

const NO_OVERRIDES: TaskNotesOverrides = {
  identification: "auto",
  taskTag: "",
  taskProperty: "",
  taskPropertyValue: "",
  completedStatuses: [],
  archiveTag: "",
  properties: {},
};

describe("importTaskNotesSettings()", (): void => {
  test("no settings object means TaskNotes is not there", (): void => {
    expect(importTaskNotesSettings(undefined)).toBe(null);
    expect(importTaskNotesSettings(null)).toBe(null);
    expect(importTaskNotesSettings("settings")).toBe(null);
    expect(importTaskNotesSettings([])).toBe(null);
  });

  test("an empty object yields TaskNotes' defaults", (): void => {
    expect(importTaskNotesSettings({})).toStrictEqual(
      DEFAULT_TASKNOTES_SETTINGS,
    );
  });

  test("renamed properties, the archive tag and the completed statuses are taken over", (): void => {
    const imported = importTaskNotesSettings({
      taskIdentificationMethod: "tag",
      taskTag: "#todo",
      fieldMapping: {
        title: "name",
        status: "state",
        due: "deadline",
        scheduled: "start",
        reminders: "alerts",
        recurrence: "repeat",
        archiveTag: "#shelved",
        priority: "prio",
      },
      customStatuses: [
        { value: "open", isCompleted: false },
        { value: "finished", isCompleted: true },
        { value: "cancelled", isCompleted: true },
        { value: "finished", isCompleted: true },
      ],
    });
    expect(imported).toStrictEqual({
      identification: "tag",
      taskTag: "todo",
      taskProperty: "",
      taskPropertyValue: "",
      completedStatuses: ["finished", "cancelled"],
      archiveTag: "shelved",
      properties: {
        title: "name",
        status: "state",
        due: "deadline",
        scheduled: "start",
        reminders: "alerts",
        recurrence: "repeat",
      },
    });
  });

  test("identification by a property keeps the name and the value", (): void => {
    const imported = importTaskNotesSettings({
      taskIdentificationMethod: "property",
      taskPropertyName: " type ",
      taskPropertyValue: " task ",
    });
    expect(imported?.identification).toBe("property");
    expect(imported?.taskProperty).toBe("type");
    expect(imported?.taskPropertyValue).toBe("task");
  });

  test("a value of another type leaves the default in place", (): void => {
    const imported = importTaskNotesSettings({
      taskIdentificationMethod: 3,
      taskTag: "",
      taskPropertyName: null,
      fieldMapping: { due: 12, reminders: "  ", archiveTag: null },
      customStatuses: "done",
    });
    expect(imported).toStrictEqual(DEFAULT_TASKNOTES_SETTINGS);
  });

  test("no status marked as completed yields none", (): void => {
    const imported = importTaskNotesSettings({
      customStatuses: [{ value: "open", isCompleted: false }, "broken"],
    });
    expect(imported?.completedStatuses).toStrictEqual([]);
  });
});

describe("exportTaskNotesSettings()", (): void => {
  test("what is saved reads back as the same settings", (): void => {
    expect(
      importTaskNotesSettings(exportTaskNotesSettings(RENAMED)),
    ).toStrictEqual(RENAMED);
    expect(
      importTaskNotesSettings(
        exportTaskNotesSettings(DEFAULT_TASKNOTES_SETTINGS),
      ),
    ).toStrictEqual(DEFAULT_TASKNOTES_SETTINGS);
  });
});

describe("taskNotesDefaults()", (): void => {
  const live = exportTaskNotesSettings(RENAMED);
  const saved = exportTaskNotesSettings({ ...RENAMED, taskTag: "old" });

  test("the running TaskNotes plugin comes first", (): void => {
    expect(taskNotesDefaults(live, saved)).toStrictEqual({
      settings: RENAMED,
      source: "tasknotes",
    });
  });

  test("without TaskNotes, what was last seen is used", (): void => {
    expect(taskNotesDefaults(undefined, saved)).toStrictEqual({
      settings: { ...RENAMED, taskTag: "old" },
      source: "saved",
    });
  });

  test("with neither, TaskNotes' factory defaults are used", (): void => {
    expect(taskNotesDefaults(undefined, undefined)).toStrictEqual({
      settings: DEFAULT_TASKNOTES_SETTINGS,
      source: "builtin",
    });
    expect(taskNotesDefaults("broken", 3)).toStrictEqual({
      settings: DEFAULT_TASKNOTES_SETTINGS,
      source: "builtin",
    });
  });

  test("a TaskNotes whose settings changed shape degrades field by field", (): void => {
    const { settings, source } = taskNotesDefaults(
      { fieldMapping: "moved elsewhere", taskTag: "todo" },
      saved,
    );
    expect(source).toBe("tasknotes");
    expect(settings).toStrictEqual({
      ...DEFAULT_TASKNOTES_SETTINGS,
      taskTag: "todo",
    });
  });
});

describe("resolveTaskNotesSettings()", (): void => {
  test("nothing set here means the defaults throughout", (): void => {
    expect(resolveTaskNotesSettings(NO_OVERRIDES, RENAMED)).toStrictEqual(
      RENAMED,
    );
  });

  test("a value set here wins over the default", (): void => {
    const resolved = resolveTaskNotesSettings(
      {
        ...NO_OVERRIDES,
        completedStatuses: ["closed"],
        archiveTag: " attic ",
        properties: { due: "until", reminders: "  " },
      },
      RENAMED,
    );
    expect(resolved.completedStatuses).toStrictEqual(["closed"]);
    expect(resolved.archiveTag).toBe("attic");
    expect(resolved.properties).toStrictEqual({
      ...RENAMED.properties,
      due: "until",
    });
  });

  test("with auto, the tag and property typed here are not used", (): void => {
    const resolved = resolveTaskNotesSettings(
      { ...NO_OVERRIDES, taskTag: "mine", taskProperty: "kind" },
      RENAMED,
    );
    expect(resolved.identification).toBe("property");
    expect(resolved.taskTag).toBe("todo");
    expect(resolved.taskProperty).toBe("type");
    expect(resolved.taskPropertyValue).toBe("task");
  });

  test("a method chosen here uses the tag or property set here", (): void => {
    const byTag = resolveTaskNotesSettings(
      { ...NO_OVERRIDES, identification: "tag", taskTag: "mine" },
      RENAMED,
    );
    expect(byTag.identification).toBe("tag");
    expect(byTag.taskTag).toBe("mine");

    const emptyTag = resolveTaskNotesSettings(
      { ...NO_OVERRIDES, identification: "tag" },
      RENAMED,
    );
    expect(emptyTag.taskTag).toBe("todo");

    const byProperty = resolveTaskNotesSettings(
      { ...NO_OVERRIDES, identification: "property", taskProperty: "kind" },
      RENAMED,
    );
    expect(byProperty.identification).toBe("property");
    expect(byProperty.taskProperty).toBe("kind");
    // Empty is "any value" here, not "the default".
    expect(byProperty.taskPropertyValue).toBe("");
  });
});
