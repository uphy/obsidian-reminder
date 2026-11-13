/**
 * Builds the Advanced settings models and adds their ordered page to the tab.
 */
import { ExcludedPathsSerde, RawSerde } from "plugin/settings/serdes";
import type { SettingModel } from "plugin/settings/setting-model";
import { SettingTabModel } from "plugin/settings/tab-model";

export class AdvancedSettings {
  excludedPaths: SettingModel<string, Array<string>>;
  editDetectionSec: SettingModel<number, number>;
  reminderCheckIntervalSec: SettingModel<number, number>;

  constructor(private settings: SettingTabModel) {
    this.excludedPaths = this.settings
      .newSettingBuilder()
      .key("excludedPaths")
      .name("Excluded files/folders")
      .desc(
        "Reminders in these files/folders are ignored. One vault-relative path per line (e.g. Templates or Archive/2020).",
      )
      .tag("re-scan")
      .textArea("")
      .placeHolder("Templates\nArchive/2020")
      .build(new ExcludedPathsSerde());

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
  }

  addToTab(): void {
    this.settings
      .newPage("Advanced")
      .newGroup()
      .addSettings(
        this.excludedPaths,
        this.editDetectionSec,
        this.reminderCheckIntervalSec,
      );
  }
}
