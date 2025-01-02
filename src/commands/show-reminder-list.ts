import type ReminderPlugin from 'main';

export function showReminderList(checking: boolean, plugin: ReminderPlugin) {
  if (!checking) {
    plugin.showReminderList();
  }
  return true;
}
