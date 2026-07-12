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
import { DateTime, Later, Time } from "model/time";
import moment from "moment";
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

export class Settings {
  settings: SettingTabModel = new SettingTabModel();

  reminderTime: SettingModel<string, Time>;
  reminderTimeStep: SettingModel<number, number>;
  enableNotification: SettingModel<boolean, boolean>;
  notificationPopupStyle: SettingModel<string, string>;
  openNoteOnReminderClick: SettingModel<boolean, boolean>;
  useSystemNotification: SettingModel<boolean, boolean>;
  showPopupWithSystemNotification: SettingModel<boolean, boolean>;
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
  dataviewReminderFieldName: SettingModel<string, string>;
  linkDatesToDailyNotes: SettingModel<boolean, boolean>;
  yearMonthDisplayFormat: SettingModel<string, string>;
  monthDayDisplayFormat: SettingModel<string, string>;
  timeDisplayFormat: SettingModel<string, string>;
  shortDateWithWeekdayDisplayFormat: SettingModel<string, string>;
  editDetectionSec: SettingModel<number, number>;
  reminderCheckIntervalSec: SettingModel<number, number>;
  showOverdueCountInStatusBar: SettingModel<boolean, boolean>;

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

    this.settings
      .newPage("Notifications")
      .newGroup()
      .addSettings(
        this.reminderTime,
        this.reminderTimeStep,
        this.laters,
        this.enableNotification,
        this.notificationPopupStyle,
        this.openNoteOnReminderClick,
        this.useSystemNotification,
        this.showPopupWithSystemNotification,
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
