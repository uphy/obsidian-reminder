import type ReminderPlugin from "main";
import type { Later } from "model/time";
import { Notice } from "obsidian";
import { DndDurationModal } from "plugin/ui/dnd-duration-chooser";

/**
 * Do-not-disturb actions shared by the "Pause reminder notifications" /
 * "Resume reminder notifications" commands, the status bar indicator, and
 * the "Pause all notifications..." link in the reminder popup, so all of
 * them stay in sync on how `dndUntil` is set/cleared, persisted, and
 * reported to the user.
 */

export function pauseNotifications(plugin: ReminderPlugin, later: Later): void {
  const until = later.later();
  plugin.data.dndUntil.value = until;
  void plugin.data.save(true);
  plugin.ui.refreshDndStatusBar();
  new Notice(
    `Reminder notifications paused until ${until.format("YYYY-MM-DD HH:mm")}`,
  );
}

export function resumeNotifications(plugin: ReminderPlugin): void {
  plugin.data.dndUntil.value = null;
  void plugin.data.save(true);
  plugin.ui.refreshDndStatusBar();
  new Notice("Reminder notifications resumed");
}

export function showPauseDurationChooser(plugin: ReminderPlugin): void {
  new DndDurationModal(plugin.app, plugin.settings.laters.value, (later) => {
    pauseNotifications(plugin, later);
  }).open();
}
