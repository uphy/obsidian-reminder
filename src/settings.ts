import { App, PluginSettingTab, Plugin_2, Setting } from "obsidian";
import { PluginDataIO } from "./data";
import { Reference } from "./model/ref";
import { Time } from "./model/time";

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
  }
}
