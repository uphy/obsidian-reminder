import {
  importTaskNotesRuntimeSettings,
  importTaskNotesSettings,
} from "./settings-import";

const taskNotesSettings = {
  fieldMapping: {
    title: "task_title",
    status: "state",
    due: "deadline",
    scheduled: "planned",
    reminders: "alerts",
    completedDate: "completed_on",
    recurrence: "repeat",
    completeInstances: "complete_instances",
    skippedInstances: "skipped_instances",
    archiveTag: "archived",
  },
  taskIdentificationMethod: "property",
  taskTag: "todo",
  taskPropertyName: "kind",
  taskPropertyValue: "task",
  excludedFolders: "Archive, Templates",
  customStatuses: [
    { value: "open", isCompleted: false },
    { value: "done", isCompleted: true },
    { value: "cancelled", isCompleted: true },
  ],
};

describe("importTaskNotesSettings", (): void => {
  test("maps relevant TaskNotes settings into Reminder Plugin settings", (): void => {
    expect(importTaskNotesSettings(taskNotesSettings)).toEqual({
      identificationMode: "property",
      tag: "todo",
      identificationProperty: "kind",
      identificationValue: "task",
      excludedFolders: "Archive\nTemplates",
      completedStatuses: "done\ncancelled",
      archiveTag: "archived",
      properties: {
        title: "task_title",
        status: "state",
        due: "deadline",
        scheduled: "planned",
        reminders: "alerts",
        completedDate: "completed_on",
        recurrence: "repeat",
        completeInstances: "complete_instances",
        skippedInstances: "skipped_instances",
      },
    });
  });

  test("keeps an empty completed status list when TaskNotes has no completed statuses", (): void => {
    expect(
      importTaskNotesSettings({
        ...taskNotesSettings,
        customStatuses: [{ value: "open", isCompleted: false }],
      }).completedStatuses,
    ).toBe("");
  });

  test.each([
    [undefined, "TaskNotes settings are unavailable."],
    [
      { ...taskNotesSettings, fieldMapping: undefined },
      "TaskNotes fieldMapping settings are unavailable.",
    ],
    [
      {
        ...taskNotesSettings,
        fieldMapping: { ...taskNotesSettings.fieldMapping, due: "" },
      },
      'TaskNotes field mapping "due" must not be empty.',
    ],
    [
      { ...taskNotesSettings, taskIdentificationMethod: "folder" },
      "TaskNotes task identification must be set to tag or property.",
    ],
    [
      { ...taskNotesSettings, customStatuses: [{ value: "done" }] },
      "TaskNotes custom status settings are invalid.",
    ],
  ])("rejects incomplete or malformed settings", (settings, message): void => {
    expect(() => importTaskNotesSettings(settings)).toThrow(message);
  });
});

describe("importTaskNotesRuntimeSettings", (): void => {
  test("combines the runtime settings snapshot and status catalog", (): void => {
    const { customStatuses, ...snapshot } = taskNotesSettings;
    expect(importTaskNotesRuntimeSettings(snapshot, customStatuses)).toEqual(
      importTaskNotesSettings(taskNotesSettings),
    );
  });

  test("rejects a missing runtime status catalog", (): void => {
    const { customStatuses: _customStatuses, ...snapshot } = taskNotesSettings;
    expect(() => importTaskNotesRuntimeSettings(snapshot, undefined)).toThrow(
      "TaskNotes status catalog is unavailable.",
    );
  });
});
