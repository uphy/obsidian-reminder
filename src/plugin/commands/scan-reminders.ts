import type ReminderPlugin from "main";

export function scanReminders(
  checking: boolean,
  plugin: ReminderPlugin,
): boolean {
  if (checking) {
    return true;
  }
  // The command's check callback must return synchronously; the reload
  // itself is intentionally fire-and-forget here.
  void plugin.fileSystem.reloadRemindersInAllFiles();
  return true;
}
