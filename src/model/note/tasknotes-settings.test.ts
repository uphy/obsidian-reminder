import {
  DEFAULT_TASKNOTES_SETTINGS,
  importTaskNotesSettings,
} from "./tasknotes-settings";

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
