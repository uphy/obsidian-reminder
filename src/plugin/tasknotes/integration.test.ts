import { TFile } from "obsidian";
import type { App, CachedMetadata, EventRef, Plugin } from "obsidian";
import { Reminder } from "model/reminder";
import { Reminders } from "model/reminders";
import { DateTime } from "model/time";
import { Settings } from "plugin/settings";
import type { PluginData } from "plugin/core/data";
import { TaskNotesIntegration } from "./integration";

describe("TaskNotesIntegration", (): void => {
  test("removes a note's TaskNotes reminders when its reminders property is deleted", async (): Promise<void> => {
    let onMetadataChanged:
      | ((file: TFile, data: string, cache: CachedMetadata | null) => void)
      | undefined;
    const file = Object.assign(new TFile(), {
      path: "Tasks/Task.md",
      extension: "md",
      basename: "Task",
    });
    const app = {
      metadataCache: {
        getFileCache: () => null,
        on: (_event: string, callback: typeof onMetadataChanged): EventRef => {
          onMetadataChanged = callback;
          return {};
        },
        offref: (): void => {},
      },
      vault: {
        getMarkdownFiles: () => [],
        on: (): EventRef => ({}),
        offref: (): void => {},
      },
    } as unknown as App;
    const plugin = {
      register: (): void => {},
      registerEvent: (): void => {},
    } as unknown as Plugin;
    const reminders = new Reminders(() => {});
    const markdownReminder = new Reminder(
      file.path,
      "Markdown reminder",
      DateTime.parse("2026-11-20 08:00"),
      0,
      false,
    );
    const taskNotesReminder = new Reminder(
      file.path,
      "TaskNotes reminder",
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
    reminders.replaceSourceFile(file.path, "markdown", [markdownReminder]);
    reminders.replaceSourceFile(file.path, "tasknotes", [taskNotesReminder]);

    const settings = new Settings();
    settings.taskNotes.enabled.rawValue.value = true;
    const data = {
      loaded: Promise.resolve(),
      changed: false,
      taskNotesReminderState: {},
    } as unknown as PluginData;
    const integration = new TaskNotesIntegration(
      app,
      reminders,
      data,
      settings,
    );
    await integration.onLayoutReady(plugin);

    onMetadataChanged?.(file, "", null);

    expect(reminders.reminders).toEqual([markdownReminder]);
    expect(reminders.fileToReminders.get(file.path)).toEqual([
      markdownReminder,
    ]);
  });
});
