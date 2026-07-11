import type ReminderPlugin from "main";
import { isNotificationPaused } from "model/dnd";
import { DateTime } from "model/time";
import { resumeNotifications } from "plugin/dnd";

const REFRESH_INTERVAL_MILLIS = 10 * 1000;

/**
 * Status bar item that shows a do-not-disturb indicator (e.g. "🔕 Until
 * 15:30") while reminder notifications are paused, and is hidden otherwise.
 * Clicking it resumes notifications immediately.
 */
export class DndStatusBar {
  // Created lazily in `onload()` rather than the constructor, since
  // `addStatusBarItem()` is an Obsidian API call and this class (like
  // `ReminderModal`) is constructed before the plugin has loaded.
  private el?: HTMLElement;

  constructor(private plugin: ReminderPlugin) {}

  onload() {
    this.el = this.plugin.addStatusBarItem();
    this.el.addClass("reminder-dnd-status-bar");
    this.el.style.display = "none";
    this.el.style.cursor = "pointer";
    this.el.setAttribute(
      "aria-label",
      "Click to resume reminder notifications",
    );
    this.plugin.registerDomEvent(this.el, "click", () => {
      resumeNotifications(this.plugin);
    });

    this.plugin.registerInterval(
      window.setInterval(() => this.refresh(), REFRESH_INTERVAL_MILLIS),
    );
    this.refresh();
  }

  refresh() {
    if (!this.el) {
      return;
    }
    const dndUntil = this.plugin.data.dndUntil.value;
    if (!isNotificationPaused(dndUntil, DateTime.now())) {
      this.el.style.display = "none";
      return;
    }
    // `isNotificationPaused` returning true guarantees `dndUntil` is set.
    this.el.setText(`🔕 Until ${this.formatUntil(dndUntil!)}`);
    this.el.style.display = "";
  }

  private formatUntil(dndUntil: DateTime): string {
    const timeFormat = this.plugin.settings.timeDisplayFormat.value;
    const time = dndUntil.format(timeFormat);
    if (dndUntil.toYYYYMMDD() === DateTime.now().toYYYYMMDD()) {
      return time;
    }
    const dateFormat = this.plugin.settings.monthDayDisplayFormat.value;
    return `${dndUntil.format(dateFormat)} ${time}`;
  }
}
