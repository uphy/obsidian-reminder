import type { ReminderPluginUI } from "plugin/ui";

export function showReminderList(checking: boolean, ui: ReminderPluginUI) {
  if (!checking) {
    // The command's check callback must return synchronously; opening the
    // view is intentionally fire-and-forget here.
    void ui.showReminderList();
  }
  return true;
}
