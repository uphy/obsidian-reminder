import type ReminderPlugin from "main";
import {
  canSetNoteReminder,
  openNoteReminderModal,
} from "plugin/ui/note-reminder-modal";

export function setNoteReminder(
  checking: boolean,
  plugin: ReminderPlugin,
): boolean | void {
  const file = plugin.app.workspace.getActiveFile();
  if (file == null || !canSetNoteReminder(plugin, file)) {
    return false;
  }
  if (checking) {
    return true;
  }
  openNoteReminderModal(plugin, file);
}
