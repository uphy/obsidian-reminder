import {
  ReminderFormatType,
  ReminderFormatTypes,
  changeReminderFormat,
  dataviewReminderFormat,
  kanbanPluginReminderFormat,
  reminderPluginReminderFormat,
  setReminderFormatConfig,
  tasksPluginReminderFormat,
} from "model/format";
import {
  ReminderFormatConfig,
  ReminderFormatParameterKey,
} from "model/format/reminder-base";
import {
  DEFAULT_STATUSES_TEXT,
  StatusRegistry,
  formatStatusSetting,
  parseStatusSetting,
  unknownStatusTypes,
} from "model/format/status";
import type { TaskStatus } from "model/format/status";
import { DateTime, Later, Time } from "model/time";
import { isValidNtfyTopic } from "model/ntfy";
import type { TaskNotesPropertyNames } from "model/tasknotes";
import {
  LANGUAGE_SETTINGS,
  type LanguageSetting,
  languageLabel,
  setLanguage,
  t,
  weekdayName,
} from "i18n";
import { requestUrl } from "obsidian";
import { testNtfyConnection } from "plugin/ntfy";
import {
  ExcludedPathsSerde,
  LatersSerde,
  RawSerde,
  ReminderFormatTypeSerde,
  SettingTabModel,
  TimeSerde,
} from "./helper";
import type { SettingModel, SettingModelBase } from "./helper";

export const TAG_RESCAN = "re-scan";

/**
 * The default statuses the "Task statuses" setting extends, seeded from the
 * Tasks plugin's own status settings at load time (see `main.ts`): the whole
 * registry when the setting is empty, the merge base under the user's lines
 * otherwise. Empty when the Tasks plugin is absent, which keeps
 * `StatusRegistry.EMPTY`'s historical x/- behavior for an empty setting.
 */
let seededTaskStatusesText = "";

export function setSeededTaskStatuses(statuses: Array<TaskStatus>): void {
  seededTaskStatusesText = formatStatusSetting(statuses);
}

export class Settings {
  settings: SettingTabModel = new SettingTabModel();
  private taskNotesSettingsFetcher?: () => Promise<string>;

  language: SettingModel<string, string>;
  reminderTime: SettingModel<string, Time>;
  reminderTimeStep: SettingModel<number, number>;
  enableNotification: SettingModel<boolean, boolean>;
  reNotifyMutedOnStartup: SettingModel<boolean, boolean>;
  notificationPopupStyle: SettingModel<string, string>;
  openNoteOnReminderClick: SettingModel<boolean, boolean>;
  useSystemNotification: SettingModel<boolean, boolean>;
  showPopupWithSystemNotification: SettingModel<boolean, boolean>;
  keepSystemNotificationOnScreen: SettingModel<boolean, boolean>;
  focusDoneButtonOnPopup: SettingModel<boolean, boolean>;
  laters: SettingModel<string, Array<Later>>;
  weekStart: SettingModel<string, string>;
  dateFormat: SettingModel<string, string>;
  dateTimeFormat: SettingModel<string, string>;
  strictDateFormat: SettingModel<boolean, boolean>;
  autoCompleteTrigger: SettingModel<string, string>;
  convertNonTaskLines: SettingModel<boolean, boolean>;
  editorReminderDisplay: SettingModel<boolean, boolean>;
  primaryFormat: SettingModel<string, ReminderFormatType>;
  excludedPaths: SettingModel<string, Array<string>>;
  useCustomEmojiForTasksPlugin: SettingModel<boolean, boolean>;
  useReminderTimeFallbackForTasksPlugin: SettingModel<boolean, boolean>;
  removeTagsForTasksPlugin: SettingModel<boolean, boolean>;
  taskStatuses: SettingModel<string, string>;
  dataviewReminderFieldName: SettingModel<string, string>;
  linkDatesToDailyNotes: SettingModel<boolean, boolean>;
  yearMonthDisplayFormat: SettingModel<string, string>;
  monthDayDisplayFormat: SettingModel<string, string>;
  timeDisplayFormat: SettingModel<string, string>;
  shortDateWithWeekdayDisplayFormat: SettingModel<string, string>;
  editDetectionSec: SettingModel<number, number>;
  reminderCheckIntervalSec: SettingModel<number, number>;
  showOverdueCountInStatusBar: SettingModel<boolean, boolean>;
  ntfyEnabled: SettingModel<boolean, boolean>;
  ntfyServerUrl: SettingModel<string, string>;
  ntfyTopic: SettingModel<string, string>;
  ntfyAccessToken: SettingModel<string, string>;
  taskNotesEnabled: SettingModel<boolean, boolean>;
  taskNotesIdentificationMode: SettingModel<string, string>;
  taskNotesTag: SettingModel<string, string>;
  taskNotesIdentificationProperty: SettingModel<string, string>;
  taskNotesIdentificationValue: SettingModel<string, string>;
  taskNotesExcludedFolders: SettingModel<string, Array<string>>;
  taskNotesCompletedStatuses: SettingModel<string, string>;
  taskNotesSkipCompleted: SettingModel<boolean, boolean>;
  taskNotesSkipArchived: SettingModel<boolean, boolean>;
  taskNotesArchiveTag: SettingModel<string, string>;
  taskNotesSkipRecurringInstances: SettingModel<boolean, boolean>;
  taskNotesDateOnlyAnchorTime: SettingModel<string, string>;
  taskNotesIgnoreOlderThanDays: SettingModel<number, number>;
  taskNotesProperties: Record<
    keyof TaskNotesPropertyNames,
    SettingModel<string, string>
  >;

  constructor() {
    // Deliberately first in the "Display" page: it decides how every other
    // label here (and in the rest of the plugin) reads. Setting names and
    // descriptions are translated when the tab renders, so switching the
    // language only needs a re-display -- see `ReminderSettingTab`.
    const languageBuilder = this.settings
      .newSettingBuilder()
      .key("language")
      .name("Language")
      .desc(
        "Language of this plugin's own interface: settings, notices, reminder popups, the reminder list and command names. " +
          "Automatic follows Obsidian's own UI language. Month and weekday names follow the selected language as well where the display formats use them.",
      )
      .dropdown("auto");
    LANGUAGE_SETTINGS.forEach((option) => {
      languageBuilder.addOption(() => languageLabel(option), option);
    });
    this.language = languageBuilder.build(new RawSerde());
    // Also fires while `PluginData` restores the persisted settings, so a
    // saved value is applied before anything is rendered.
    this.language.rawValue.onChanged(() => {
      this.applyLanguage();
    });

    const reminderFormatSettings = new ReminderFormatSettings(this.settings);

    this.reminderTime = this.settings
      .newSettingBuilder()
      .key("reminderTime")
      .name("Reminder time")
      .desc("Time when a reminder with no time part will show")
      .tag(TAG_RESCAN)
      .text("09:00")
      .placeHolder("Time (hh:mm)")
      .build(new TimeSerde());

    this.reminderTimeStep = this.settings
      .newSettingBuilder()
      .key("reminderTimeStep")
      .name("Reminder time step (minutes)")
      .desc("Step of time for reminder time (minutes)")
      .number(15)
      .build(new RawSerde());

    this.enableNotification = this.settings
      .newSettingBuilder()
      .key("enableNotification")
      .name("Enable reminder notifications")
      .desc(
        "If disabled, reminder popups and system notifications are not shown. The reminder list view keeps working.",
      )
      .toggle(true)
      .build(new RawSerde());

    this.reNotifyMutedOnStartup = this.settings
      .newSettingBuilder()
      .key("reNotifyMutedOnStartup")
      .name("Re-notify muted reminders on startup")
      .desc(
        "When enabled, reminders you previously muted are notified again the next time Obsidian starts. " +
          "Useful if you rely on startup notifications to review overdue reminders. " +
          'If many reminders are overdue, they are shown one after another — use the "Mute all current notifications" command to silence them again.',
      )
      .toggle(false)
      .build(new RawSerde());

    this.notificationPopupStyle = this.settings
      .newSettingBuilder()
      .key("notificationPopupStyle")
      .name("Reminder popup style")
      .desc(
        "Toast: a card in the corner of the window that does not interrupt your work. Modal: a dialog in the center of the window that takes focus.",
      )
      .dropdown("toast")
      .addOption("Toast (corner card)", "toast")
      .addOption("Modal (center dialog)", "modal")
      .build(new RawSerde());

    this.openNoteOnReminderClick = this.settings
      .newSettingBuilder()
      .key("openNoteOnReminderClick")
      .name("Open note on reminder click")
      .desc(
        "When clicking a reminder in the reminder list or a system notification, open the note directly instead of showing the reminder popup.",
      )
      .toggle(false)
      .build(new RawSerde());

    this.useSystemNotification = this.settings
      .newSettingBuilder()
      .key("useSystemNotification")
      .name("Use system notification")
      .desc("Use system notification for reminder notifications")
      .toggle(false)
      .build(new RawSerde());

    this.showPopupWithSystemNotification = this.settings
      .newSettingBuilder()
      .key("showPopupWithSystemNotification")
      .name("Show popup together with system notification")
      .desc(
        "When using system notification, also show the built-in reminder popup at the same time. The popup handles the reminder actions; the system notification acts as an alert only.",
      )
      .toggle(false)
      .onAnyValueChanged((context) => {
        context.setEnabled(this.useSystemNotification.value);
      })
      .build(new RawSerde());

    this.keepSystemNotificationOnScreen = this.settings
      .newSettingBuilder()
      .key("keepSystemNotificationOnScreen")
      .name("Keep system notification on screen")
      .desc(
        "Keep the system notification on screen until you interact with it, instead of it disappearing after a few seconds. Only effective on Windows and Linux; ignored on macOS. Enable this if you use the same vault on multiple devices (e.g. via Obsidian Sync): it allows the plugin to dismiss the notification when you complete or snooze the reminder on another device.",
      )
      .toggle(false)
      .onAnyValueChanged((context) => {
        context.setEnabled(this.useSystemNotification.value);
      })
      .build(new RawSerde());

    this.focusDoneButtonOnPopup = this.settings
      .newSettingBuilder()
      .key("focusDoneButtonOnPopup")
      .name("Focus Done button on popup")
      .desc(
        "Automatically focus the Done button when a reminder popup opens, so pressing Enter completes the task. Off by default to prevent accidentally completing a reminder you haven't read.",
      )
      .toggle(false)
      .build(new RawSerde());

    this.laters = this.settings
      .newSettingBuilder()
      .key("laters")
      .name("Remind me later")
      .desc("Line-separated list of remind me later items")
      .textArea("In 30 minutes\nIn 1 hour\nIn 3 hours\nTomorrow\nNext week")
      .placeHolder("In 30 minutes\nIn 1 hour\nIn 3 hours\nTomorrow\nNext week")
      .build(new LatersSerde());

    const weekStartBuilder = this.settings
      .newSettingBuilder()
      .key("weekStart")
      .name("Week start")
      .desc("Select the first day of the week")
      .dropdown("0");
    Array.from({ length: 7 }, (_, d) => {
      // Translated when the dropdown is rendered, so the day names follow the
      // selected language (moment's own locale data is not required).
      weekStartBuilder.addOption(() => weekdayName(d), d.toString());
    });
    this.weekStart = weekStartBuilder.build(new RawSerde());

    this.dateFormat = this.settings
      .newSettingBuilder()
      .key("dateFormat")
      .name("Date format")
      .desc(
        "moment style date format: https://momentjs.com/docs/#/displaying/format/",
      )
      .tag(TAG_RESCAN)
      .text("YYYY-MM-DD")
      .placeHolder("YYYY-MM-DD")
      .onAnyValueChanged((context) => {
        context.setEnabled(
          reminderFormatSettings.enableReminderPluginReminderFormat.value,
        );
      })
      .build(new RawSerde());

    this.strictDateFormat = this.settings
      .newSettingBuilder()
      .key("strictDateFormat")
      .name("Strict date format")
      .desc("Strictly parse the date and time")
      .tag(TAG_RESCAN)
      .toggle(false)
      .onAnyValueChanged((context) => {
        context.setEnabled(
          reminderFormatSettings.enableReminderPluginReminderFormat.value,
        );
      })
      .build(new RawSerde());

    this.dateTimeFormat = this.settings
      .newSettingBuilder()
      .key("dateTimeFormat")
      .name("Date and time format")
      .desc(
        "moment() style date time format: https://momentjs.com/docs/#/displaying/format/",
      )
      .tag(TAG_RESCAN)
      .text("YYYY-MM-DD HH:mm")
      .placeHolder("YYYY-MM-DD HH:mm")
      .onAnyValueChanged((context) => {
        context.setEnabled(
          reminderFormatSettings.enableReminderPluginReminderFormat.value,
        );
      })
      .build(new RawSerde());

    this.linkDatesToDailyNotes = this.settings
      .newSettingBuilder()
      .key("linkDatesToDailyNotes")
      .name("Link dates to daily notes")
      .desc("When toggled, Dates link to daily notes.")
      .tag(TAG_RESCAN)
      .toggle(false)
      .onAnyValueChanged((context) => {
        context.setEnabled(
          reminderFormatSettings.enableReminderPluginReminderFormat.value,
        );
      })
      .build(new RawSerde());

    this.autoCompleteTrigger = this.settings
      .newSettingBuilder()
      .key("autoCompleteTrigger")
      .name("Calendar popup trigger")
      .desc("Trigger text to show calendar popup")
      .text("(@")
      .placeHolder("(@")
      .onAnyValueChanged((context) => {
        const value = this.autoCompleteTrigger.value;
        context.setInfo(
          value.length === 0 ? t("Popup is disabled") : t("Popup is enabled"),
        );
      })
      .build(new RawSerde());

    this.convertNonTaskLines = this.settings
      .newSettingBuilder()
      .key("convertNonTaskLines")
      .name("Convert non-task lines when inserting a reminder")
      .desc(
        'When inserting a reminder from the calendar popup on a line that is not a task, convert the line into a task list item ("- [ ] ") automatically. When disabled, a notice is shown instead.',
      )
      .toggle(true)
      .build(new RawSerde());

    this.editorReminderDisplay = this.settings
      .newSettingBuilder()
      .key("editorReminderDisplay")
      .name("Show reminder pills in editor")
      .desc(
        "Render each reminder's time as a clickable pill (⏰) in Live Preview. Clicking a pill opens the date/time chooser to change it. Disable to show the raw reminder text instead.",
      )
      .toggle(true)
      .build(new RawSerde());

    const primaryFormatBuilder = this.settings
      .newSettingBuilder()
      .key("primaryReminderFormat")
      .name("Primary reminder format")
      .desc("Reminder format for generated reminder by calendar popup")
      .dropdown(ReminderFormatTypes[0]!.name);
    ReminderFormatTypes.forEach((f) =>
      primaryFormatBuilder.addOption(
        () => `${t(f.description)} - ${f.example}`,
        f.name,
      ),
    );
    this.primaryFormat = primaryFormatBuilder.build(
      new ReminderFormatTypeSerde(),
    );

    this.excludedPaths = this.settings
      .newSettingBuilder()
      .key("excludedPaths")
      .name("Excluded files/folders")
      .desc(
        "Reminders in these files/folders are ignored. One vault-relative path per line (e.g. Templates or Archive/2020).",
      )
      .tag(TAG_RESCAN)
      .textArea("")
      .placeHolder("Templates\nArchive/2020")
      .build(new ExcludedPathsSerde());

    this.useCustomEmojiForTasksPlugin = this.settings
      .newSettingBuilder()
      .key("useCustomEmojiForTasksPlugin")
      .name("Distinguish between reminder date and due date")
      .desc(
        "Use custom emoji ⏰ instead of 📅 and distinguish between reminder date/time and Tasks Plugin's due date.",
      )
      .tag(TAG_RESCAN)
      .toggle(false)
      .onAnyValueChanged((context) => {
        context.setEnabled(
          reminderFormatSettings.enableTasksPluginReminderFormat.value,
        );
      })
      .build(new RawSerde());
    this.useReminderTimeFallbackForTasksPlugin = this.settings
      .newSettingBuilder()
      .key("useReminderTimeFallbackForTasksPlugin")
      .name("Fall back to due, scheduled, or start date")
      .desc(
        "When the reminder date (⏰) is missing, use the due date (📅), then the scheduled date (⏳), then the start date (🛫), in that order.",
      )
      .tag(TAG_RESCAN)
      .toggle(false)
      .onAnyValueChanged((context) => {
        context.setEnabled(
          reminderFormatSettings.enableTasksPluginReminderFormat.value &&
            this.useCustomEmojiForTasksPlugin.value,
        );
      })
      .build(new RawSerde());
    this.removeTagsForTasksPlugin = this.settings
      .newSettingBuilder()
      .key("removeTagsForTasksPlugin")
      .name("Remove tags from reminder title")
      .desc(
        "If checked, tags(#xxx) are removed from the reminder list view and notification.",
      )
      .tag(TAG_RESCAN)
      .toggle(false)
      .onAnyValueChanged((context) => {
        context.setEnabled(
          reminderFormatSettings.enableTasksPluginReminderFormat.value,
        );
      })
      .build(new RawSerde());

    this.taskStatuses = this.settings
      .newSettingBuilder()
      .key("taskStatuses")
      .name("Task statuses")
      .desc(
        "One status per line: [symbol] -> [next symbol] TYPE, where TYPE is TODO, IN_PROGRESS, DONE, CANCELLED, ON_HOLD or NON_TASK. " +
          "Decides which lines count as done (DONE/CANCELLED/NON_TASK never remind) and which symbol the Done button writes (the next symbol, when it lands on a done status). " +
          "Applies to every reminder format and to the 'Toggle checklist status' command. " +
          "Lines here extend the defaults (the Tasks plugin's status settings when that plugin is enabled, the built-in [ ]/[x]/[-] set otherwise) and win over them on a duplicate symbol. " +
          "Leave empty to follow the defaults alone.",
      )
      .tag(TAG_RESCAN)
      .textArea("")
      .placeHolder("[ ] -> [x] TODO\n[x] -> [ ] DONE\n[w] -> [v] ON_HOLD")
      .onAnyValueChanged((context) => {
        // Free text where Tasks has a dropdown: a typo like "DOME" parses
        // happily and quietly reads as TODO, so say so here. Info, not a
        // validation error — `load()` puts stored values straight into
        // `rawValue`, and an old data.json must never fail the settings tab.
        const unknown = unknownStatusTypes(this.taskStatuses.value);
        context.setInfo(
          unknown.length
            ? t("Unknown status types (treated as TODO): {types}", {
                types: unknown.join(", "),
              })
            : null,
        );
      })
      .build(new RawSerde());

    this.dataviewReminderFieldName = this.settings
      .newSettingBuilder()
      .key("dataviewReminderFieldName")
      .name("Reminder field name")
      .desc(
        "The inline field (e.g. [reminder:: 2021-09-08]) read as the reminder date. On a line that also has a due field, this field takes precedence.",
      )
      .tag(TAG_RESCAN)
      .text("reminder")
      .placeHolder("reminder")
      .onAnyValueChanged((context) => {
        context.setEnabled(
          reminderFormatSettings.enableDataviewReminderFormat.value,
        );
      })
      .build(new RawSerde());

    this.yearMonthDisplayFormat = this.settings
      .newSettingBuilder()
      .key("yearMonthDisplayFormat")
      .name("Year & month format")
      .desc(
        "Moment style year and month format:\nhttps://momentjs.com/docs/#/displaying/format/",
      )
      .text("YYYY, MMMM")
      .placeHolder("YYYY, MMMM")
      .build(new RawSerde());
    this.monthDayDisplayFormat = this.settings
      .newSettingBuilder()
      .key("monthDayDisplayFormat")
      .name("Month & day format")
      .desc(
        "Moment style month and day format:\nhttps://momentjs.com/docs/#/displaying/format/",
      )
      .text("MM/DD")
      .placeHolder("MM/DD")
      .build(new RawSerde());
    this.shortDateWithWeekdayDisplayFormat = this.settings
      .newSettingBuilder()
      .key("shortDateWithWeekdayDisplayFormat")
      .name("Short date with weekday format")
      .desc(
        "Moment style short date with weekday format:\nhttps://momentjs.com/docs/#/displaying/format/",
      )
      .text("M/DD (ddd)")
      .placeHolder("M/DD (ddd)")
      .build(new RawSerde());
    this.timeDisplayFormat = this.settings
      .newSettingBuilder()
      .key("timeDisplayFormat")
      .name("Time format")
      .desc(
        "Moment style time format:\nhttps://momentjs.com/docs/#/displaying/format/",
      )
      .text("HH:mm")
      .placeHolder("HH:mm")
      .build(new RawSerde());

    this.editDetectionSec = this.settings
      .newSettingBuilder()
      .key("editDetectionSec")
      .name("Edit detection time")
      .desc(
        "The minimum amount of time (in seconds) after a key is typed that it will be identified as notifiable. Only applies to the Modal popup style; Toast reminders are shown immediately even while typing.",
      )
      .number(10)
      .build(new RawSerde());
    this.reminderCheckIntervalSec = this.settings
      .newSettingBuilder()
      .key("reminderCheckIntervalSec")
      .name("Reminder check interval")
      .desc(
        "Interval(in seconds) to periodically check whether or not you should be notified of reminders.  You will need to restart Obsidian for this setting to take effect.",
      )
      .number(5)
      .build(new RawSerde());

    this.showOverdueCountInStatusBar = this.settings
      .newSettingBuilder()
      .key("showOverdueCountInStatusBar")
      .name("Show overdue count in status bar")
      .desc(
        "Show the number of overdue reminders in the status bar. Click it to open the reminder list.",
      )
      .toggle(true)
      .build(new RawSerde());

    this.ntfyEnabled = this.settings
      .newSettingBuilder()
      .key("ntfyEnabled")
      .name("Enable ntfy scheduled notifications (experimental)")
      .desc(
        "Publish upcoming reminders to the ntfy server below as scheduled push notifications, so you're notified even when Obsidian isn't running (useful on mobile, where plugins can't run in the background). " +
          "This sends reminder titles to that server, so only enable this if you trust it. " +
          "Requires an ntfy server running v2.16.0 or later (needed for sequence-ID based scheduled message replacement/deletion). " +
          "Only reminders due within the next 24 hours are registered — ntfy itself allows scheduling at most 3 days ahead, and this plugin periodically re-registers reminders to roll that 24-hour window forward.",
      )
      .toggle(false)
      .build(new RawSerde());

    this.ntfyServerUrl = this.settings
      .newSettingBuilder()
      .key("ntfyServerUrl")
      .name("ntfy server URL")
      .desc("The ntfy server to publish scheduled notifications to.")
      .text("https://ntfy.sh")
      .placeHolder("https://ntfy.sh")
      .build(new RawSerde());

    this.ntfyTopic = this.settings
      .newSettingBuilder()
      .key("ntfyTopic")
      .name("ntfy topic")
      .desc(
        "Topic to publish reminders to. Anyone who knows this topic name can subscribe to it and read your reminder titles, so use a long, hard-to-guess name rather than something predictable. " +
          "May only contain letters, digits, dashes and underscores (1-64 characters).",
      )
      .text("")
      .placeHolder("a-long-random-topic-name")
      // Validated here rather than in a Serde that throws: a Serde rejection
      // also makes `value` throw when the *persisted* value is invalid, and
      // an invalid topic is exactly what someone upgrading from a build
      // without this check may already have saved. `NtfyController` runs the
      // same check before sending anything, so a bad name never reaches the
      // network either way.
      .onAnyValueChanged((context) => {
        const topic = this.ntfyTopic.value.trim();
        context.setValidationError(
          topic.length === 0 || isValidNtfyTopic(topic)
            ? null
            : t(
                "A topic may only contain letters, digits, dashes and underscores (1-64 characters).",
              ),
        );
      })
      .build(new RawSerde());

    this.ntfyAccessToken = this.settings
      .newSettingBuilder()
      .key("ntfyAccessToken")
      .name("ntfy access token")
      .desc(
        "Only needed for a server that requires authentication (a self-hosted instance with access control, for example); leave it empty otherwise. " +
          "Create one with `ntfy token add <user>` or from the ntfy web app under Account → Access tokens. The token needs read-write access to the topic above, because this plugin reads, publishes and deletes scheduled messages. " +
          "It is stored in plain text in this plugin's data.json, which is synced along with your vault if you sync your Obsidian configuration folder.",
      )
      .text("")
      .masked()
      .placeHolder("tk_...")
      .button("Test", async (context) => {
        context.setValidationError(null);
        context.setInfo(t("Testing…"));
        const result = await testNtfyConnection(
          async (request) => requestUrl({ ...request, throw: false }),
          {
            serverUrl: this.ntfyServerUrl.value,
            topic: this.ntfyTopic.value,
            accessToken: this.ntfyAccessToken.value,
          },
        );
        context.setInfo(result.ok ? result.message : null);
        context.setValidationError(result.ok ? null : result.message);
      })
      // Clears a stale test result once any setting is edited, so the line
      // under this field never describes a configuration that's no longer
      // the one on screen.
      .onAnyValueChanged((context) => {
        context.setInfo(null);
      })
      .build(new RawSerde());

    this.taskNotesEnabled = this.settings
      .newSettingBuilder()
      .key("taskNotesEnabled")
      .name("Enable TaskNotes integration")
      .desc(
        "Read TaskNotes reminder metadata from task-note frontmatter. Writing a completed status is optional and controlled by the Done behavior setting.",
      )
      .toggle(false)
      .button("Fetch from TaskNotes", async (context) => {
        context.setValidationError(null);
        context.setInfo("Fetching settings from TaskNotes…");
        try {
          const fetchSettings = this.taskNotesSettingsFetcher;
          if (!fetchSettings) {
            throw new Error("TaskNotes settings fetch is not available.");
          }
          context.setInfo(await fetchSettings());
        } catch (error) {
          console.error("Failed to fetch TaskNotes settings: %o", error);
          context.setInfo(null);
          context.setValidationError(
            error instanceof Error
              ? error.message
              : "Could not fetch TaskNotes settings.",
          );
        }
      })
      .build(new RawSerde());
    const taskNotesIdentificationMode = this.settings
      .newSettingBuilder()
      .key("taskNotesIdentificationMode")
      .name("Task identification mode")
      .desc("Choose which notes are considered TaskNotes tasks.")
      .dropdown("tag")
      .addOption("Task tag", "tag")
      .addOption("Property", "property")
      .addOption("Any note with valid reminders", "reminders");
    this.taskNotesIdentificationMode = taskNotesIdentificationMode.build(
      new RawSerde(),
    );
    this.taskNotesTag = this.settings
      .newSettingBuilder()
      .key("taskNotesTag")
      .name("Task tag")
      .desc(
        "Tag used to identify task notes when identification mode is Task tag.",
      )
      .text("task")
      .placeHolder("task")
      .build(new RawSerde());
    this.taskNotesIdentificationProperty = this.settings
      .newSettingBuilder()
      .key("taskNotesIdentificationProperty")
      .name("Task identification property")
      .desc("Property name used to identify task notes in Property mode.")
      .text("type")
      .placeHolder("type")
      .build(new RawSerde());
    this.taskNotesIdentificationValue = this.settings
      .newSettingBuilder()
      .key("taskNotesIdentificationValue")
      .name("Task identification property value")
      .desc(
        "Required property value. Leave empty to identify notes by property presence.",
      )
      .text("task")
      .placeHolder("task")
      .build(new RawSerde());
    this.taskNotesExcludedFolders = this.settings
      .newSettingBuilder()
      .key("taskNotesExcludedFolders")
      .name("Excluded folders")
      .desc(
        "One folder path per line. TaskNotes reminders in these folders are ignored.",
      )
      .textArea("")
      .build(new ExcludedPathsSerde());
    this.taskNotesCompletedStatuses = this.settings
      .newSettingBuilder()
      .key("taskNotesCompletedStatuses")
      .name("Completed statuses")
      .desc("One completed status per line.")
      .textArea("done")
      .build(new RawSerde());
    this.taskNotesSkipCompleted = this.settings
      .newSettingBuilder()
      .key("taskNotesSkipCompleted")
      .name("Skip completed tasks")
      .desc(
        "Skip tasks with a completed status, status: true, or a completedDate on a non-recurring task.",
      )
      .toggle(true)
      .build(new RawSerde());
    this.taskNotesSkipArchived = this.settings
      .newSettingBuilder()
      .key("taskNotesSkipArchived")
      .name("Skip archived tasks")
      .desc("Skip tasks carrying the configured archive tag.")
      .toggle(true)
      .build(new RawSerde());
    this.taskNotesArchiveTag = this.settings
      .newSettingBuilder()
      .key("taskNotesArchiveTag")
      .name("Archive tag")
      .desc("Tag used to identify archived tasks.")
      .text("archived")
      .placeHolder("archived")
      .build(new RawSerde());
    this.taskNotesSkipRecurringInstances = this.settings
      .newSettingBuilder()
      .key("taskNotesSkipRecurringInstances")
      .name("Skip completed recurring instances")
      .desc(
        "Skip a reminder when its anchor date appears in complete_instances or skipped_instances.",
      )
      .toggle(true)
      .build(new RawSerde());
    this.taskNotesDateOnlyAnchorTime = this.settings
      .newSettingBuilder()
      .key("taskNotesDateOnlyAnchorTime")
      .name("Date-only anchor time")
      .desc(
        "Local time used when a due or scheduled date has no time component. TaskNotes specifies 00:00 by default.",
      )
      .text("00:00")
      .placeHolder("00:00")
      .build(new RawSerde());
    this.taskNotesIgnoreOlderThanDays = this.settings
      .newSettingBuilder()
      .key("taskNotesIgnoreOlderThanDays")
      .name("Ignore reminders older than (days)")
      .desc(
        "Ignore TaskNotes reminders whose trigger is older than this many days, preventing a flood when the integration is enabled.",
      )
      .number(1)
      .build(new RawSerde());
    const propertySetting = (
      key: string,
      name: string,
      value: string,
    ): SettingModel<string, string> =>
      this.settings
        .newSettingBuilder()
        .key(key)
        .name(name)
        .text(value)
        .placeHolder(value)
        .build(new RawSerde());
    this.taskNotesProperties = {
      title: propertySetting("taskNotesPropertyTitle", "Title", "title"),
      status: propertySetting("taskNotesPropertyStatus", "Status", "status"),
      due: propertySetting("taskNotesPropertyDue", "Due", "due"),
      scheduled: propertySetting(
        "taskNotesPropertyScheduled",
        "Scheduled",
        "scheduled",
      ),
      reminders: propertySetting(
        "taskNotesPropertyReminders",
        "Reminders",
        "reminders",
      ),
      completedDate: propertySetting(
        "taskNotesPropertyCompletedDate",
        "Completed date",
        "completedDate",
      ),
      recurrence: propertySetting(
        "taskNotesPropertyRecurrence",
        "Recurrence",
        "recurrence",
      ),
      completeInstances: propertySetting(
        "taskNotesPropertyCompleteInstances",
        "Complete instances",
        "complete_instances",
      ),
      skippedInstances: propertySetting(
        "taskNotesPropertySkippedInstances",
        "Skipped instances",
        "skipped_instances",
      ),
    };

    this.settings
      .newPage("Notifications")
      .newGroup()
      .addSettings(
        this.reminderTime,
        this.reminderTimeStep,
        this.laters,
        this.enableNotification,
        this.reNotifyMutedOnStartup,
        this.notificationPopupStyle,
        this.openNoteOnReminderClick,
        this.useSystemNotification,
        this.showPopupWithSystemNotification,
        this.keepSystemNotificationOnScreen,
        this.focusDoneButtonOnPopup,
        this.showOverdueCountInStatusBar,
      );
    const taskNotesPage = this.settings.newPage("TaskNotes integration");
    taskNotesPage
      .newGroup()
      .addSettings(
        this.taskNotesEnabled,
        this.taskNotesIdentificationMode,
        this.taskNotesTag,
        this.taskNotesIdentificationProperty,
        this.taskNotesIdentificationValue,
        this.taskNotesExcludedFolders,
        this.taskNotesCompletedStatuses,
        this.taskNotesSkipCompleted,
        this.taskNotesSkipArchived,
        this.taskNotesArchiveTag,
        this.taskNotesSkipRecurringInstances,
        this.taskNotesDateOnlyAnchorTime,
        this.taskNotesIgnoreOlderThanDays,
      );
    taskNotesPage
      .newGroup("TaskNotes property names", true)
      .addSettings(...Object.values(this.taskNotesProperties));
    this.settings
      .newPage("Editor")
      .newGroup()
      .addSettings(
        this.autoCompleteTrigger,
        this.convertNonTaskLines,
        this.primaryFormat,
        this.editorReminderDisplay,
      );
    const reminderFormatsPage = this.settings.newPage("Reminder formats");
    reminderFormatsPage
      .newGroup("Reminder plugin format")
      .addSettings(
        reminderFormatSettings.enableReminderPluginReminderFormat,
        this.dateFormat,
        this.dateTimeFormat,
        this.strictDateFormat,
        this.linkDatesToDailyNotes,
      );
    reminderFormatsPage
      .newGroup("Tasks plugin format")
      .addSettings(
        reminderFormatSettings.enableTasksPluginReminderFormat,
        this.useCustomEmojiForTasksPlugin,
        this.useReminderTimeFallbackForTasksPlugin,
        this.removeTagsForTasksPlugin,
      );
    // A group of its own, not a "Tasks plugin format" sibling: the registry
    // drives isChecked/setChecked for EVERY format plus the
    // toggle-checklist-status command — only the seed comes from Tasks. It
    // also must not take that group's setEnabled wiring: users with the
    // Tasks format turned off are exactly the ones who need to edit this.
    reminderFormatsPage
      .newGroup("Task statuses")
      .addSettings(this.taskStatuses);
    reminderFormatsPage
      .newGroup("Dataview format")
      .addSettings(
        reminderFormatSettings.enableDataviewReminderFormat,
        this.dataviewReminderFieldName,
      );
    reminderFormatsPage
      .newGroup("Kanban plugin format")
      .addSettings(reminderFormatSettings.enableKanbanPluginReminderFormat);
    this.settings.newPage("Display").newGroup().addSettings(
      // First in this tab on purpose: it changes how every other label on
      // this page reads.
      this.language,
      this.yearMonthDisplayFormat,
      this.monthDayDisplayFormat,
      this.shortDateWithWeekdayDisplayFormat,
      this.timeDisplayFormat,
      this.weekStart,
    );
    this.settings
      .newPage("ntfy")
      .newGroup()
      .addSettings(
        this.ntfyEnabled,
        this.ntfyServerUrl,
        this.ntfyTopic,
        this.ntfyAccessToken,
      );
    // Last: "Advanced" is the catch-all for settings that don't belong to a
    // feature of their own, so feature pages go in front of it.
    this.settings
      .newPage("Advanced")
      .newGroup()
      .addSettings(
        this.excludedPaths,
        this.editDetectionSec,
        this.reminderCheckIntervalSec,
      );
  }

  setTaskNotesSettingsFetcher(fetcher: () => Promise<string>): void {
    this.taskNotesSettingsFetcher = fetcher;
  }

  /**
   * Applies the "Language" setting value to the translation layer.
   *
   * A fresh install has no persisted value for this setting, so `load()` never
   * assigns it and the setting's own change listener never fires: the plugin
   * calls this once after loading, to resolve "automatic" against Obsidian's
   * UI language. Safe to call repeatedly -- it only notifies when the resolved
   * language actually changes.
   */
  public applyLanguage(): void {
    setLanguage(this.language.value as LanguageSetting);
  }

  /**
   * Installs this instance's setting values as the process-wide reminder-format
   * config (via `setReminderFormatConfig()`), rebinding the config used by every
   * reminder-format singleton (e.g. `TasksPluginFormat.instance`).
   *
   * This has a global side effect and must be called exactly once, for the
   * plugin's real `Settings` instance (see `PluginData`'s constructor). A
   * stray `new Settings()` elsewhere (e.g. previously in a UI component) must
   * never call this, or it would silently revert every format setting to its
   * default value for the whole process (see issue #248).
   */
  public wireReminderFormatConfig(): void {
    const config = new ReminderFormatConfig();
    config.setParameterFunc(ReminderFormatParameterKey.now, () =>
      DateTime.now(),
    );
    config.setParameter(
      ReminderFormatParameterKey.useCustomEmojiForTasksPlugin,
      this.useCustomEmojiForTasksPlugin,
    );
    config.setParameter(
      ReminderFormatParameterKey.linkDatesToDailyNotes,
      this.linkDatesToDailyNotes,
    );
    config.setParameter(
      ReminderFormatParameterKey.removeTagsForTasksPlugin,
      this.removeTagsForTasksPlugin,
    );
    config.setParameter(
      ReminderFormatParameterKey.useReminderTimeFallbackForTasksPlugin,
      this.useReminderTimeFallbackForTasksPlugin,
    );
    config.setParameter(
      ReminderFormatParameterKey.dataviewReminderFieldName,
      this.dataviewReminderFieldName,
    );
    // The registry is rebuilt only when the effective text changes: parsing
    // runs per keystroke otherwise (every parse() call reads the parameter).
    let lastText: string | null = null;
    let lastRegistry = StatusRegistry.EMPTY;
    config.setParameterFunc(ReminderFormatParameterKey.taskStatuses, () => {
      // The user's lines EXTEND the defaults rather than replacing them:
      // someone who adds just "[/] -> [x] IN_PROGRESS" must not turn every
      // "- [x]" in the vault back into an active reminder. User lines come
      // first, and the registry keeps the first definition per symbol, so a
      // user line wins on a duplicate. An empty setting stays the pure
      // seed/EMPTY path, which is what preserves the historical behavior
      // when neither the user nor the Tasks plugin defines anything.
      const userText = this.taskStatuses.value;
      const text = userText.trim().length
        ? userText +
          "\n" +
          (seededTaskStatusesText.trim().length
            ? seededTaskStatusesText
            : DEFAULT_STATUSES_TEXT)
        : seededTaskStatusesText;
      if (text !== lastText) {
        lastText = text;
        lastRegistry = new StatusRegistry(parseStatusSetting(text));
      }
      return lastRegistry;
    });
    setReminderFormatConfig(config);
  }

  public forEach(consumer: (setting: SettingModelBase) => void) {
    this.settings.forEach(consumer);
  }
}

class ReminderFormatSettings {
  private settingKeyToFormatName: Map<string, ReminderFormatType> = new Map();
  reminderFormatSettings: Array<SettingModel<boolean, boolean>> = [];

  enableReminderPluginReminderFormat: SettingModel<boolean, boolean>;
  enableTasksPluginReminderFormat: SettingModel<boolean, boolean>;
  enableKanbanPluginReminderFormat: SettingModel<boolean, boolean>;
  enableDataviewReminderFormat: SettingModel<boolean, boolean>;

  constructor(private settings: SettingTabModel) {
    this.enableReminderPluginReminderFormat =
      this.createUseReminderFormatSetting(reminderPluginReminderFormat);
    this.enableTasksPluginReminderFormat = this.createUseReminderFormatSetting(
      tasksPluginReminderFormat,
    );
    this.enableKanbanPluginReminderFormat = this.createUseReminderFormatSetting(
      kanbanPluginReminderFormat,
    );
    this.enableDataviewReminderFormat = this.createUseReminderFormatSetting(
      dataviewReminderFormat,
    );
  }

  private createUseReminderFormatSetting(format: ReminderFormatType) {
    const key = `enable${format.name}`;
    const setting = this.settings
      .newSettingBuilder()
      .key(key)
      .name(() => t("Enable {format}", { format: t(format.description) }))
      .desc("Recognize reminders written in this format.")
      .tag(TAG_RESCAN)
      .toggle(format.defaultEnabled)
      .onAnyValueChanged((context) => {
        context.setInfo(
          t("Example: {example}", {
            example:
              format.format.appendReminder("- [ ] Task 1", DateTime.now())
                ?.insertedLine ?? "",
          }),
        );
      })
      .build(new RawSerde());

    this.settingKeyToFormatName.set(key, format);
    this.reminderFormatSettings.push(setting);

    setting.rawValue.onChanged(() => {
      this.updateReminderFormat();
    });
    return setting;
  }

  private updateReminderFormat() {
    const selectedFormats = this.reminderFormatSettings
      .filter((s) => s.value)
      .map((s) => this.settingKeyToFormatName.get(s.key))
      .filter((s): s is ReminderFormatType => s !== undefined);
    changeReminderFormat(selectedFormats);
  }
}
