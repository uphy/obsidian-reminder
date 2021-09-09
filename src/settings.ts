import { App, PluginSettingTab, Plugin_2 } from "obsidian";
import { SettingModel, SettingModelBuilder, TimeSerde, RawSerde, LatersSerde } from "model/settings";
import { Time, Later } from "model/time";
import { changeReminderFormat, ReminderFormatType, ReminderFormatTypes } from "model/format";

export const TAG_RESCAN = "re-scan";

class SettingGroup {
  constructor(public name: string, public settings: Array<SettingModel<any, any>>) {
  }
}

class Settings {

  groups: Array<SettingGroup> = [];
  reminderTime: SettingModel<string, Time>;
  useSystemNotification: SettingModel<boolean, boolean>;
  laters: SettingModel<string, Array<Later>>;
  dateFormat: SettingModel<string, string>;
  dateTimeFormat: SettingModel<string, string>;
  autoCompleteTrigger: SettingModel<string, string>;

  constructor() {
    this.reminderTime = this.builder()
      .key("reminderTime")
      .name("Reminder Time")
      .desc("Time when a reminder with no time part will show")
      .tag(TAG_RESCAN)
      .text("09:00")
      .placeHolder("Time (hh:mm)")
      .build(new TimeSerde());

    this.useSystemNotification = this.builder()
      .key("useSystemNotification")
      .name("Use system notification")
      .desc("Use system notification for reminder notifications")
      .toggle(false)
      .build(new RawSerde());

    this.laters = this.builder()
      .key("laters")
      .name("Remind me later")
      .desc("Line-separated list of remind me later items")
      .textArea("In 30 minutes\nIn 1 hour\nIn 3 hours\nTomorrow\nNext week")
      .placeHolder("In 30 minutes\nIn 1 hour\nIn 3 hours\nTomorrow\nNext week")
      .build(new LatersSerde());

    this.dateFormat = this.builder()
      .key("dateFormat")
      .name("Date format")
      .desc("moment style date format: https://momentjs.com/docs/#/displaying/format/")
      .tag(TAG_RESCAN)
      .text("YYYY-MM-DD")
      .placeHolder("YYYY-MM-DD")
      .build(new RawSerde());

    this.dateTimeFormat = this.builder()
      .key("dateTimeFormat")
      .name("Date and time format")
      .desc("moment() style date time format: https://momentjs.com/docs/#/displaying/format/")
      .tag(TAG_RESCAN)
      .text("YYYY-MM-DD HH:mm")
      .placeHolder("YYYY-MM-DD HH:mm")
      .build(new RawSerde());

    this.autoCompleteTrigger = this.builder()
      .key("autoCompleteTrigger")
      .name("Calendar popup trigger")
      .desc("Trigger text to show calendar popup")
      .text("(@")
      .placeHolder("(@")
      .build(new RawSerde());

    const settingKeyToFormatName = new Map<string, ReminderFormatType>();
    const reminderFormatSettings = ReminderFormatTypes.map(format => {
      const key = `enable${format.name}`;
      const setting = this.builder()
        .key(key)
        .name(`Enable ${format.description}`)
        .desc(`Enable ${format.description} e.g. ${format.example}`)
        .tag(TAG_RESCAN)
        .toggle(format.defaultEnabled)
        .build(new RawSerde());
      settingKeyToFormatName.set(key, format);
      return setting;
    });
    reminderFormatSettings.forEach(setting => {
      setting.rawValue.onChanged(() => {
        const selectedFormats = reminderFormatSettings
          .filter(s => s.value)
          .map(s => settingKeyToFormatName.get(s.key));
        changeReminderFormat(selectedFormats);
      });
    });

    this.groups.push(new SettingGroup("Reminder Settings", [
      this.reminderTime,
      this.laters,
      this.dateFormat,
      this.dateTimeFormat
    ]));
    this.groups.push(new SettingGroup("Reminder Format", [
      ...reminderFormatSettings
    ]));
    this.groups.push(new SettingGroup("Notification Settings", [
      this.useSystemNotification
    ]));
    this.groups.push(new SettingGroup("Editor", [
      this.autoCompleteTrigger
    ]));
  }

  public forEach(consumer: (setting: SettingModel<any, any>) => void) {
    this.groups.forEach(group => {
      group.settings.forEach(setting => {
        consumer(setting);
      })
    })
  }

  private builder(): SettingModelBuilder {
    return new SettingModelBuilder();
  }
}

export const SETTINGS = new Settings();

export class ReminderSettingTab extends PluginSettingTab {
  constructor(
    app: App,
    plugin: Plugin_2
  ) {
    super(app, plugin);
  }

  display(): void {
    let { containerEl } = this;

    containerEl.empty();

    SETTINGS.groups.forEach(group => {
      containerEl.createEl('h3', { text: group.name });
      group.settings.forEach(settings => {
        settings.createSetting(containerEl);
      });
    })
  }
}
