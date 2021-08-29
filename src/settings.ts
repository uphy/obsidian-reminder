import { App, PluginSettingTab, Plugin_2, Setting } from "obsidian";
import { PluginDataIO } from "./data";
import { parseLaters, Time } from "./model/time";

// TODO notification type
export class ReminderSettingTab extends PluginSettingTab {
  constructor(
    app: App,
    plugin: Plugin_2,
    private pluginDataIO: PluginDataIO
  ) {
    super(app, plugin);
  }

  display(): void {
    let { containerEl } = this;

    containerEl.empty();

    const reminderTime = this.pluginDataIO.reminderTime;
    const useSystemNotification = this.pluginDataIO.useSystemNotification;
    const laters = this.pluginDataIO.laters;

    new Setting(containerEl)
      .setName("Reminder Time")
      .setDesc("Time when the reminder which has time part will show.")
      .addText((text) =>
        text
          .setPlaceholder("Time (hh:mm)")
          .setValue(reminderTime.value.toString())
          .onChange(async (value) => {
            try {
              reminderTime.value = Time.parse(value);
            } catch (e) {
              console.log(e);
            }
          })
      );
    new Setting(containerEl)
      .setName("Use system notification")
      .setDesc("Use system notification for reminder notifications")
      .addToggle((toggle) =>
        toggle
          .setValue(useSystemNotification.value)
          .onChange(async (value) => {
            useSystemNotification.value = value;
          })
      );
    new Setting(containerEl)
      .setName("Remind me later")
      .setDesc("Comma-separated list of remind me later items")
      .addTextArea((textarea) => {
        textarea
          .setValue(laters.value)
          .setPlaceholder("In 30 minutes, In 1 hour, In 3 hours, Tomorrow, Next week")
          .onChange(async (value) => {
            try {
              const parsed = parseLaters(value);
              console.log(parsed.map(p => p.label));
              laters.value = value;
            } catch (e) { }
          });
      })
  }
}
