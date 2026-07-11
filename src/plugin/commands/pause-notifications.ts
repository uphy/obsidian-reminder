import type ReminderPlugin from "main";
import { showPauseDurationChooser } from "plugin/dnd";

export function pauseNotifications(
  checking: boolean,
  plugin: ReminderPlugin,
): boolean {
  if (checking) {
    return true;
  }
  showPauseDurationChooser(plugin);
  return true;
}
