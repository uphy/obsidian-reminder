import { t } from "i18n";
import {
  ReminderFormatType,
  changeReminderFormat,
  dataviewReminderFormat,
  kanbanPluginReminderFormat,
  reminderPluginReminderFormat,
  tasksPluginReminderFormat,
} from "model/format";
import { DateTime } from "model/time";
import { RawSerde } from "plugin/settings/serdes";
import { SettingTabModel } from "plugin/settings/tab-model";
import { SettingContext } from "plugin/settings/setting-model";
import type { SettingModel } from "plugin/settings/setting-model";

export const TAG_RESCAN = "re-scan";

export class ReminderFormatSettings {
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

  private createUseReminderFormatSetting(
    format: ReminderFormatType,
  ): SettingModel<boolean, boolean> {
    const key = `enable${format.name}`;
    const setting = this.settings
      .newSettingBuilder()
      .key(key)
      .name(() => t("Enable {format}", { format: t(format.description) }))
      .desc("Recognize reminders written in this format.")
      .tag(TAG_RESCAN)
      .toggle(format.defaultEnabled)
      .onAnyValueChanged((context: SettingContext) => {
        context.setInfo(
          t("Example: {example}", {
            example:
              format.format.appendReminder("- [ ] Task 1", DateTime.now())
                ?.insertedLine ?? "",
          }),
        );
      })
      .build(new RawSerde<boolean>());

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
