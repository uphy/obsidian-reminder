import type ReminderPlugin from "main";
import { isNotificationPaused } from "model/dnd";
import { DateTime } from "model/time";
import { resumeNotifications as clearDnd } from "plugin/dnd";

export function resumeNotifications(
  checking: boolean,
  plugin: ReminderPlugin,
): boolean {
  const paused = isNotificationPaused(
    plugin.data.dndUntil.value,
    DateTime.now(),
  );
  if (!paused) {
    // Only enabled while paused, mirroring how other commands gate on
    // whether their action currently makes sense.
    return false;
  }
  if (checking) {
    return true;
  }
  clearDnd(plugin);
  return true;
}
