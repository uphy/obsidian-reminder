import type { EditorView } from "@codemirror/view";
import type ReminderPlugin from "main";
import type { App as ObsidianApp, Plugin } from "obsidian";

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
        /**
         * Read for its date/time format settings so reminders written in
         * Kanban's format round-trip; see `model/format/reminder-kanban-plugin`.
         * Optional because the plugin may not be installed, and the settings
         * are `unknown` because their shape belongs to that plugin.
         */
        "obsidian-kanban"?: { settings?: Record<string, unknown> };
        "obsidian-tasks-plugin"?: Plugin;
      };
    };
  }

  interface Editor {
    /**
     * The CodeMirror 6 view backing this editor. Not part of Obsidian's
     * public API and absent on mobile, so every use has to handle undefined.
     */
    cm?: EditorView;
  }
}
