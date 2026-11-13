import { ReminderFormatTypes, setReminderFormatConfig } from "model/format";
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
import { DateTime } from "model/time";
import { type LanguageSetting, setLanguage, t, weekdayName } from "i18n";
import { AdvancedSettings } from "plugin/settings/sections/advanced";
import { DisplaySettings } from "plugin/settings/sections/display";
import { EditorSettings } from "plugin/settings/sections/editor";
import { NtfySettings } from "plugin/settings/sections/ntfy";
import { NotificationsSettings } from "plugin/settings/sections/notifications";
import { TaskNotesSettings } from "plugin/settings/sections/tasknotes";
import { SettingTabModel } from "./tab-model";
import {
  ExcludedPathsSerde,
  RawSerde,
  ReminderFormatTypeSerde,
} from "./serdes";
import { SettingContext } from "./setting-model";
import type { SettingModel, SettingModelBase } from "./setting-model";
import { ReminderFormatSettings } from "./sections/reminder-formats";

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
  notifications: NotificationsSettings;
  taskNotes: TaskNotesSettings;
  ntfy: NtfySettings;
  editor: EditorSettings;
  display: DisplaySettings;
  advanced: AdvancedSettings;

  dateFormat: SettingModel<string, string>;
  dateTimeFormat: SettingModel<string, string>;
  strictDateFormat: SettingModel<boolean, boolean>;
  useCustomEmojiForTasksPlugin: SettingModel<boolean, boolean>;
  useReminderTimeFallbackForTasksPlugin: SettingModel<boolean, boolean>;
  removeTagsForTasksPlugin: SettingModel<boolean, boolean>;
  taskStatuses: SettingModel<string, string>;
  dataviewReminderFieldName: SettingModel<string, string>;
  linkDatesToDailyNotes: SettingModel<boolean, boolean>;
  constructor() {
    const reminderFormatSettings = new ReminderFormatSettings(this.settings);

    this.display = new DisplaySettings(this.settings, reminderFormatSettings);
    // Also fires while `PluginData` restores the persisted settings, so a
    // saved value is applied before anything is rendered.
    this.display.language.rawValue.onChanged(() => {
      this.applyLanguage();
    });

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
      .onAnyValueChanged((context: SettingContext) => {
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
      .onAnyValueChanged((context: SettingContext) => {
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
      .onAnyValueChanged((context: SettingContext) => {
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
      .onAnyValueChanged((context: SettingContext) => {
        context.setEnabled(
          reminderFormatSettings.enableReminderPluginReminderFormat.value,
        );
      })
      .build(new RawSerde());

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

    this.autoCompleteTrigger = this.settings
      .newSettingBuilder()
      .key("autoCompleteTrigger")
      .name("Calendar popup trigger")
      .desc("Trigger text to show calendar popup")
      .text("(@")
      .placeHolder("(@")
      .onAnyValueChanged((context: SettingContext) => {
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
        "Render each reminder's time as a clickable pill (â°) in Live Preview. Clicking a pill opens the date/time chooser to change it. Disable to show the raw reminder text instead.",
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
        "Use custom emoji â° instead of ðŸ“… and distinguish between reminder date/time and Tasks Plugin's due date.",
      )
      .tag(TAG_RESCAN)
      .toggle(false)
      .onAnyValueChanged((context: SettingContext) => {
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
        "When the reminder date (â°) is missing, use the due date (ðŸ“…), then the scheduled date (â³), then the start date (ðŸ›«), in that order.",
      )
      .tag(TAG_RESCAN)
      .toggle(false)
      .onAnyValueChanged((context: SettingContext) => {
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
      .onAnyValueChanged((context: SettingContext) => {
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
      .onAnyValueChanged((context: SettingContext) => {
        // Free text where Tasks has a dropdown: a typo like "DOME" parses
        // happily and quietly reads as TODO, so say so here. Info, not a
        // validation error â€” `load()` puts stored values straight into
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
      .onAnyValueChanged((context: SettingContext) => {
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

    this.ntfy = new NtfySettings(this.settings);

    this.notifications = new NotificationsSettings(this.settings);
    this.taskNotes = new TaskNotesSettings(this.settings);
    this.editor = new EditorSettings(this.settings, reminderFormatSettings);

    this.notifications.addToTab();
    this.taskNotes.addToTab();
    this.editor.addToTab();
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
    // toggle-checklist-status command â€” only the seed comes from Tasks. It
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
    this.display = new DisplaySettings(this.settings, reminderFormatSettings);
    this.display.addToTab();
    this.ntfy.addToTab();
    this.advanced = new AdvancedSettings(this.settings);
    this.advanced.addToTab();
  }

  setTaskNotesSettingsFetcher(fetcher: () => Promise<string>): void {
    this.taskNotes.setSettingsFetcher(fetcher);
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
    setLanguage(this.display.language.value as LanguageSetting);
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
