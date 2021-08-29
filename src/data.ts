import { Plugin_2 } from "obsidian";
import { Reference } from "./model/ref";
import { Reminder, Reminders } from "./model/reminder";
import { DateTime } from "./model/time";
import { SETTINGS } from "./settings"

interface ReminderData {
  title: string;
  time: string;
  rowNumber: number;
}

export class PluginDataIO {

  changed: boolean = false;
  public scanned: Reference<boolean> = new Reference(false);

  constructor(private plugin: Plugin_2, private reminders: Reminders) {
    SETTINGS.forEach(setting => {
      setting.rawValue.onChanged(() => {
        console.log(setting);
        this.changed = true;
      });
    })
  }

  async load() {
    console.debug("Load reminder plugin data");
    const data = await this.plugin.loadData();
    this.scanned.value = data.scanned;

    const loadedSettings = data.settings;
    SETTINGS.forEach(setting => {
      setting.load(loadedSettings);
    })

    if (data.reminders) {
      Object.keys(data.reminders).forEach((filePath) => {
        const remindersInFile = data.reminders[filePath] as Array<ReminderData>;
        if (!remindersInFile) {
          return;
        }
        this.reminders.replaceFile(
          filePath,
          remindersInFile.map(
            (d) =>
              new Reminder(
                filePath,
                d.title,
                DateTime.parse(d.time),
                d.rowNumber
              )
          )
        );
      });
    }
    this.changed = false;
  }

  async save(force: boolean = false) {
    if (!force && !this.changed) {
      return;
    }
    console.debug(
      "Save reminder plugin data: force=%s, changed=%s",
      force,
      this.changed
    );
    const remindersData: any = {};
    this.reminders.fileToReminders.forEach((r, filePath) => {
      remindersData[filePath] = r.map((rr) => ({
        title: rr.title,
        time: rr.time.toString(),
        rowNumber: rr.rowNumber,
      }));
    });
    const settings = {};
    SETTINGS.forEach(setting => {
      setting.store(settings);
    })
    await this.plugin.saveData({
      scanned: this.scanned.value,
      reminders: remindersData,
      settings
    });
    this.changed = false;
  }
}
