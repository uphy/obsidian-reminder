import { App, PluginSettingTab, Plugin_2 } from "obsidian";
import { SettingModel, SettingModelBuilder, TimeSerde, RawSerde, LatersSerde, ReminderFormatSerde } from "model/settings";
import { Time, Later } from "model/time";
import { DefaultReminderFormat, ReminderFormat, REMINDER_FORMAT, TasksPluginFormat } from "model/format";
import { Reference } from "model/ref";

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

  // reminder format
  enableReminderPluginReminderFormat: SettingModel<boolean, boolean>;
  enableTasksPluginReminderFormat: SettingModel<boolean, boolean>;
  reminderFormat: Reference<ReminderFormat>;

  constructor() {
    this.reminderTime = this.builder()
      .key("reminderTime")
      .name("Reminder Time")
      .desc("Time when a reminder with no time part will show")
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
      .text("YYYY-MM-DD")
      .placeHolder("YYYY-MM-DD")
      .build(new RawSerde());

    this.dateTimeFormat = this.builder()
      .key("dateTimeFormat")
      .name("Date and time format")
      .desc("moment() style date time format: https://momentjs.com/docs/#/displaying/format/")
      .text("YYYY-MM-DD HH:mm")
      .placeHolder("YYYY-MM-DD HH:mm")
      .build(new RawSerde());

    this.enableReminderPluginReminderFormat = this.builder()
      .key("enableReminderPluginReminderFormat")
      .name("Enable reminder plugin format")
      .desc("Enable reminder plugin format e.g. (@2021-09-08)")
      .toggle(true)
      .build(new RawSerde());

    this.enableTasksPluginReminderFormat = this.builder()
      .key("enableTasksPluginReminderFormat")
      .name("Enable tasks plugin format")
      .desc("Enable reminder plugin format e.g. 📅2021-09-08")
      .toggle(false)
      .build(new RawSerde());

    this.groups.push(new SettingGroup("Reminder Settings", [
      this.reminderTime,
      this.laters,
      this.dateFormat,
      this.dateTimeFormat
    ]));
    this.groups.push(new SettingGroup("Reminder Format", [
      this.enableReminderPluginReminderFormat,
      this.enableTasksPluginReminderFormat,
    ]));
    this.groups.push(new SettingGroup("Notification Settings", [
      this.useSystemNotification
    ]));

    this.initReminderFormat();
  }

  private initReminderFormat() {
    const updateReminderFormat = () => {
      const formats: Array<ReminderFormat> = []
      if (this.enableReminderPluginReminderFormat.value) {
        formats.push(DefaultReminderFormat.instance);
      }
      if (this.enableTasksPluginReminderFormat.value) {
        formats.push(TasksPluginFormat.instance);
      }
      if (formats.length === 0) {
        formats.push(DefaultReminderFormat.instance);
      }
      REMINDER_FORMAT.resetFormat(formats);
    }
    this.enableReminderPluginReminderFormat.rawValue.onChanged(() => {
      updateReminderFormat();
    })
    this.enableTasksPluginReminderFormat.rawValue.onChanged(() => {
      updateReminderFormat();
    });
    updateReminderFormat();
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
