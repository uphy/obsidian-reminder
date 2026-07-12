import type ReminderPlugin from "main";

const REFRESH_INTERVAL_MILLIS = 10 * 1000;

/**
 * Status bar item that shows the number of overdue reminders (e.g. "⏰ 3"),
 * including muted ones -- they are still overdue, just silenced. Hidden when
 * there are none, or when the [[Settings.showOverdueCountInStatusBar]]
 * setting is off. Clicking it opens the reminder list view.
 */
export class OverdueStatusBar {
  // Created lazily in `onload()` rather than the constructor, since
  // `addStatusBarItem()` is an Obsidian API call and this class (like
  // `DndStatusBar`) is constructed before the plugin has loaded.
  private el?: HTMLElement;

  constructor(private plugin: ReminderPlugin) {}

  onload() {
    this.el = this.plugin.addStatusBarItem();
    this.el.addClass("reminder-overdue-status-bar");
    this.el.style.display = "none";
    this.el.style.cursor = "pointer";
    this.el.setAttribute(
      "aria-label",
      "Overdue reminders — click to open the reminder list",
    );
    this.plugin.registerDomEvent(this.el, "click", () => {
      void this.plugin.ui.showReminderList();
    });

    this.plugin.settings.showOverdueCountInStatusBar.rawValue.onChanged(() =>
      this.refresh(),
    );

    this.plugin.registerInterval(
      window.setInterval(() => this.refresh(), REFRESH_INTERVAL_MILLIS),
    );
    this.refresh();
  }

  refresh() {
    if (!this.el) {
      return;
    }
    if (!this.plugin.settings.showOverdueCountInStatusBar.value) {
      this.el.style.display = "none";
      return;
    }
    const count = this.plugin.reminders.getExpiredReminders(
      this.plugin.settings.reminderTime.value,
    ).length;
    if (count === 0) {
      this.el.style.display = "none";
      return;
    }
    this.el.setText(`⏰ ${count}`);
    this.el.style.display = "";
  }
}
