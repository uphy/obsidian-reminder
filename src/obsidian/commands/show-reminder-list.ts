import type { ReminderPluginUI } from 'obsidian/ui';

export function showReminderList(checking: boolean, ui: ReminderPluginUI) {
  if (!checking) {
    ui.showReminderList();
  }
  return true;
}
