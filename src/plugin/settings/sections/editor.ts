/**
 * Builds the Editor settings models and adds their ordered page to the tab.
 */
import { RawSerde, ReminderFormatTypeSerde } from "plugin/settings/serdes";
import { SettingContext } from "plugin/settings/setting-model";
import type { SettingModel } from "plugin/settings/setting-model";
import { SettingTabModel } from "plugin/settings/tab-model";
import { ReminderFormatType, ReminderFormatTypes } from "model/format";
import { t } from "i18n";

export class EditorSettings {
  autoCompleteTrigger: SettingModel<string, string>;
  convertNonTaskLines: SettingModel<boolean, boolean>;
  primaryFormat: SettingModel<string, ReminderFormatType>;
  editorReminderDisplay: SettingModel<boolean, boolean>;

  constructor(
    private settings: SettingTabModel,
    private reminderFormatSettings: {
      enableReminderPluginReminderFormat: SettingModel<boolean, boolean>;
    },
  ) {
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

    this.editorReminderDisplay = this.settings
      .newSettingBuilder()
      .key("editorReminderDisplay")
      .name("Show reminder pills in editor")
      .desc(
        "Render each reminder's time as a clickable pill (⏰) in Live Preview. Clicking a pill opens the date/time chooser to change it. Disable to show the raw reminder text instead.",
      )
      .toggle(true)
      .build(new RawSerde());
  }

  addToTab(): void {
    this.settings
      .newPage("Editor")
      .newGroup()
      .addSettings(
        this.autoCompleteTrigger,
        this.convertNonTaskLines,
        this.primaryFormat,
        this.editorReminderDisplay,
      );
  }
}
