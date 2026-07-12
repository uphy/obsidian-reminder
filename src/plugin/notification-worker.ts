import type { Reminder } from "model/reminder";

/**
 * The minimal set of dependencies `NotificationWorker` needs from the rest
 * of the plugin. Keeping this narrow (rather than depending on the whole
 * `ReminderPlugin`) lets this file avoid importing `obsidian` entirely, so
 * it can be unit-tested like the rest of `model/`.
 */
export interface NotificationWorkerDeps {
  registerInterval(id: number): void;
  isLayoutReady(): boolean;
  reloadUI(force: boolean): void;
  isEditing(): boolean;
  /**
   * True when showing a reminder would open a focus-stealing UI (the modal
   * popup style). Used to decide whether edit detection should defer the
   * popup.
   */
  isPopupIntrusive(): boolean;
  showReminder(reminder: Reminder): void;
  isScanned(): boolean;
  markScanned(): void;
  saveData(force?: boolean): void;
  reloadRemindersInAllFiles(): Promise<void>;
  getExpiredReminders(): Array<Reminder>;
  checkIntervalSec(): number;
  isNotificationEnabled(): boolean;
  isNotificationPaused(): boolean;
}

export class NotificationWorker {
  private lastExpiredKeys: Set<string> = new Set();

  constructor(private deps: NotificationWorkerDeps) {}

  startPeriodicTask() {
    let intervalTaskRunning = true;
    // Force the view to refresh as soon as possible. This is intentionally
    // fire-and-forget; the loop below tracks completion via `intervalTaskRunning`.
    void this.periodicTask().finally(() => {
      intervalTaskRunning = false;
    });

    // Set up the recurring check for reminders.
    this.deps.registerInterval(
      window.setInterval(() => {
        if (intervalTaskRunning) {
          console.debug(
            "Skip reminder interval task because task is already running.",
          );
          return;
        }
        intervalTaskRunning = true;
        void this.periodicTask().finally(() => {
          intervalTaskRunning = false;
        });
      }, this.deps.checkIntervalSec() * 1000),
    );
  }

  private async periodicTask(): Promise<void> {
    this.deps.reloadUI(false);

    if (!this.deps.isScanned()) {
      // Intentionally not awaited: the initial full-vault scan runs
      // concurrently with the rest of this periodic task rather than
      // blocking it.
      void this.deps.reloadRemindersInAllFiles().then(() => {
        this.deps.markScanned();
        this.deps.saveData();
      });
    }

    this.deps.saveData(false);

    // Edit detection only defers focus-stealing popups (the modal style);
    // non-intrusive styles (toast) show immediately even while typing.
    if (this.deps.isPopupIntrusive() && this.deps.isEditing()) {
      return;
    }

    const expired = this.deps.getExpiredReminders();

    // The reminder list view only re-renders when it is invalidated
    // (reminders added/edited); mere passage of time never invalidates it.
    // Force a reload when reminders newly become expired so they move to
    // the "Overdue" group — this must happen regardless of whether
    // notifications are enabled. Only new expirations trigger the reload,
    // to avoid re-rendering the list on every tick.
    const expiredKeys = new Set(expired.map((r) => r.key()));
    for (const key of expiredKeys) {
      if (!this.lastExpiredKeys.has(key)) {
        this.deps.reloadUI(true);
        break;
      }
    }
    this.lastExpiredKeys = expiredKeys;

    if (!this.deps.isNotificationEnabled()) {
      // Notifications are disabled, but everything above (reloadUI, the
      // initial scan, saveData, and the newly-expired forced reload) must
      // still run so the reminder list view stays up to date even while
      // popups/system notifications are suppressed.
      return;
    }

    if (this.deps.isNotificationPaused()) {
      // Do-not-disturb is active. As with the disabled-notifications guard
      // above, everything above it must still run. Reminders are not muted
      // by the pause, so anything still expired fires on the next tick once
      // the pause ends.
      return;
    }

    let previousReminder: Reminder | undefined = undefined;
    for (const reminder of expired) {
      if (this.deps.isLayoutReady()) {
        if (reminder.muteNotification) {
          // We don't want to set `previousReminder` in this case as the current
          // reminder won't be shown.
          continue;
        }
        if (previousReminder) {
          while (previousReminder.beingDisplayed) {
            // Displaying too many reminders at once can cause crashes on
            // mobile. We use `beingDisplayed` to wait for the current modal to
            // be dismissed before displaying the next.
            await this.sleep(100);
          }
        }
        this.deps.showReminder(reminder);
        previousReminder = reminder;
      }
    }
  }

  /* An asynchronous sleep function. To use it you must `await` as it hands
   * off control to other portions of the JS control loop whilst waiting.
   *
   * @param milliseconds - The number of milliseconds to wait before resuming.
   */
  private async sleep(milliseconds: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
  }
}
