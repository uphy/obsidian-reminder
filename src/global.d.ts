import type ReminderPlugin from "main";
import type { App as ObsidianApp } from "obsidian";

declare global {
  interface Window {
    app: ObsidianApp;
  }
}
declare module "obsidian" {
  interface App {
    plugins: {
      plugins: {
        "obsidian-reminder-plugin": ReminderPlugin;
      };
    };
  }
}
