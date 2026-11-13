/**
 * Builds the Display settings models and adds their ordered page to the tab.
 */
import { RawSerde } from "plugin/settings/serdes";
import type { SettingModel } from "plugin/settings/setting-model";
import { SettingTabModel } from "plugin/settings/tab-model";
import { LANGUAGE_SETTINGS, languageLabel } from "i18n";

export class DisplaySettings {
  language: SettingModel<string, string>;
  yearMonthDisplayFormat: SettingModel<string, string>;
  monthDayDisplayFormat: SettingModel<string, string>;
  shortDateWithWeekdayDisplayFormat: SettingModel<string, string>;
  timeDisplayFormat: SettingModel<string, string>;
  weekStart: SettingModel<string, string>;

  constructor(
    private settings: SettingTabModel,
    private reminderFormatSettings: {
      enableReminderPluginReminderFormat: SettingModel<boolean, boolean>;
    },
  ) {
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
    LANGUAGE_SETTINGS.forEach((option: string) => {
      languageBuilder.addOption(() => languageLabel(option), option);
    });
    this.language = languageBuilder.build(new RawSerde());
    // Also fires while `PluginData` restores the persisted settings, so a
    // saved value is applied before anything is rendered.
    this.language.rawValue.onChanged(() => {
      // applyLanguage is called by the plugin
    });

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

    const weekStartBuilder = this.settings
      .newSettingBuilder()
      .key("weekStart")
      .name("Week start")
      .desc("Select the first day of the week")
      .dropdown("0");
    Array.from({ length: 7 }, (_, d) => {
      // Translated when the dropdown is rendered, so the day names follow the
      // selected language (moment's own locale data is not required).
      weekStartBuilder.addOption(() => languageLabel(d), d.toString());
    });
    this.weekStart = weekStartBuilder.build(new RawSerde());
  }

  addToTab(): void {
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
  }
}
