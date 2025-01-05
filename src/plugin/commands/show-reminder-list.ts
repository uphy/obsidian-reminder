import type { ReminderPluginUI } from "plugin/ui";

export function showReminderList(checking: boolean, ui: ReminderPluginUI) {
  if (!checking) {
    ui.showReminderList();
  }
  return true;
}
