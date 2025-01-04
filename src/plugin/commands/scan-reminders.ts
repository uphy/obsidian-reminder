import type ReminderPlugin from 'main';

export function scanReminders(checking: boolean, plugin: ReminderPlugin): boolean {
  if (checking) {
    return true;
  }
  plugin.fileSystem.reloadRemindersInAllFiles();
  return true;
}
