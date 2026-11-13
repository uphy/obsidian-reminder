import { Settings } from "plugin/settings";

/**
 * Characterization test: locks the order of the settings pages and of the
 * settings inside them. Restructuring the `Settings` class must not change
 * what the settings tab shows, or in which order. Update these lists ONLY when
 * a setting is intentionally added, removed, renamed or reordered.
 */
describe("settings layout", () => {
  const settings = new Settings();

  test("pages keep their order", () => {
    const pages = (
      settings.settings as unknown as { pages: Array<{ name: string }> }
    ).pages.map((page) => page.name);
    expect(pages).toEqual([
      "Notifications",
      "TaskNotes integration",
      "Editor",
      "Reminder formats",
      "Display",
      "ntfy",
      "Advanced",
    ]);
  });

  test("settings keep their keys and order", () => {
    const keys: Array<string> = [];
    settings.settings.forEach((setting) => keys.push(setting.key));
    expect(keys).toEqual([
      "reminderTime",
      "reminderTimeStep",
      "laters",
      "enableNotification",
      "reNotifyMutedOnStartup",
      "notificationPopupStyle",
      "openNoteOnReminderClick",
      "useSystemNotification",
      "showPopupWithSystemNotification",
      "keepSystemNotificationOnScreen",
      "focusDoneButtonOnPopup",
      "showOverdueCountInStatusBar",
      "taskNotesEnabled",
      "taskNotesIdentificationMode",
      "taskNotesTag",
      "taskNotesIdentificationProperty",
      "taskNotesIdentificationValue",
      "taskNotesExcludedFolders",
      "taskNotesCompletedStatuses",
      "taskNotesSkipCompleted",
      "taskNotesSkipArchived",
      "taskNotesArchiveTag",
      "taskNotesSkipRecurringInstances",
      "taskNotesDateOnlyAnchorTime",
      "taskNotesIgnoreOlderThanDays",
      "taskNotesPropertyTitle",
      "taskNotesPropertyStatus",
      "taskNotesPropertyDue",
      "taskNotesPropertyScheduled",
      "taskNotesPropertyReminders",
      "taskNotesPropertyCompletedDate",
      "taskNotesPropertyRecurrence",
      "taskNotesPropertyCompleteInstances",
      "taskNotesPropertySkippedInstances",
      "autoCompleteTrigger",
      "convertNonTaskLines",
      "primaryReminderFormat",
      "editorReminderDisplay",
      "enableReminderPluginReminderFormat",
      "dateFormat",
      "dateTimeFormat",
      "strictDateFormat",
      "linkDatesToDailyNotes",
      "enableTasksPluginReminderFormat",
      "useCustomEmojiForTasksPlugin",
      "useReminderTimeFallbackForTasksPlugin",
      "removeTagsForTasksPlugin",
      "taskStatuses",
      "enableDataviewReminderFormat",
      "dataviewReminderFieldName",
      "enableKanbanPluginReminderFormat",
      "language",
      "yearMonthDisplayFormat",
      "monthDayDisplayFormat",
      "shortDateWithWeekdayDisplayFormat",
      "timeDisplayFormat",
      "weekStart",
      "ntfyEnabled",
      "ntfyServerUrl",
      "ntfyTopic",
      "ntfyAccessToken",
      "excludedPaths",
      "editDetectionSec",
      "reminderCheckIntervalSec",
    ]);
  });
});
