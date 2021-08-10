import { App, PluginSettingTab, Plugin_2, Setting } from "obsidian";
import { PluginDataIO } from "./data";
import { Reference } from "./model/ref";
import { Time } from "./model/time";

// TODO notification type
export class ReminderSettingTab extends PluginSettingTab {
  constructor(
    app: App,
    plugin: Plugin_2,
    private reminderTime: Reference<Time>
  ) {
    super(app, plugin);
  }

  display(): void {
    let { containerEl } = this;

    containerEl.empty();

    containerEl.createEl("h2", { text: "Settings for my awesome plugin." });

    new Setting(containerEl)
      .setName("Reminder Time")
      .setDesc("Time when the reminder which has time part will show.")
      .addText((text) =>
        text
          .setPlaceholder("Time (hh:mm)")
          .setValue(this.reminderTime.value.toString())
          .onChange(async (value) => {
            try {
              this.reminderTime.value = Time.parse(value);
            } catch (e) {
              console.log(e);
            }
          })
      );
  }
}
