import type ReminderPlugin from "main";
import { Notice } from "obsidian";

export function muteAllReminders(
  checking: boolean,
  plugin: ReminderPlugin,
): boolean {
  const expired = plugin.reminders.getExpiredReminders(
    plugin.settings.reminderTime.value,
  );
  // Only available when the command would actually mute something: if every
  // expired reminder is already muted, running it would just report
  // "Muted 0 reminders".
  if (!expired.some((r) => !r.muteNotification)) {
    return false;
  }
  if (checking) {
    return true;
  }
  const count = plugin.reminders.muteExpiredReminders(
    plugin.settings.reminderTime.value,
  );
  plugin.ui.reload(true);
  void plugin.data.save(true);
  new Notice(`Muted ${count} reminder${count === 1 ? "" : "s"}`);
  return true;
}
