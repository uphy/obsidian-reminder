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
import { moment } from "model/moment";
import { isValidNtfyTopic } from "model/ntfy";
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

  constructor() {
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
      const dayName = moment().day(d).format("dddd");
      weekStartBuilder.addOption(dayName, d.toString());
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
          `Popup is ${value.length === 0 ? "disabled" : "enabled"}`,
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
      primaryFormatBuilder.addOption(`${f.description} - ${f.example}`, f.name),
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
            ? `Unknown status types (treated as TODO): ${unknown.join(", ")}`
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
            : "A topic may only contain letters, digits, dashes and underscores (1-64 characters).",
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
        context.setInfo("Testing…");
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
    this.settings
      .newPage("Display")
      .newGroup()
      .addSettings(
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
      .name(`Enable ${format.description}`)
      .desc("Recognize reminders written in this format.")
      .tag(TAG_RESCAN)
      .toggle(format.defaultEnabled)
      .onAnyValueChanged((context) => {
        context.setInfo(
          `Example: ${format.format.appendReminder("- [ ] Task 1", DateTime.now())?.insertedLine}`,
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
