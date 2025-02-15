import type ReminderPlugin from "main";

declare global {
  interface Window {
    app: App;
  }
  interface App {
    plugins: {
      plugins: {
        "obsidian-reminder-plugin": ReminderPlugin;
      };
    };
  }
}
