import type ReminderPlugin from 'main';
import type { Reminder } from 'model/reminder';

export class NotificationWorker {
  constructor(private plugin: ReminderPlugin) {}

  startPeriodicTask() {
    let intervalTaskRunning = true;
    // Force the view to refresh as soon as possible.
    this.periodicTask().finally(() => {
      intervalTaskRunning = false;
    });

    // Set up the recurring check for reminders.
    this.plugin.registerInterval(
      window.setInterval(() => {
        if (intervalTaskRunning) {
          console.log('Skip reminder interval task because task is already running.');
          return;
        }
        intervalTaskRunning = true;
        this.periodicTask().finally(() => {
          intervalTaskRunning = false;
        });
      }, this.plugin.settings.reminderCheckIntervalSec.value * 1000),
    );
  }

  private async periodicTask(): Promise<void> {
    this.plugin.ui.reload(false);

    if (!this.plugin.pluginDataIO.scanned.value) {
      this.plugin.fileSystem.reloadRemindersInAllFiles().then(() => {
        this.plugin.pluginDataIO.scanned.value = true;
        this.plugin.pluginDataIO.save();
      });
    }

    this.plugin.pluginDataIO.save(false);

    if (this.plugin.ui.isEditing()) {
      return;
    }
    const expired = this.plugin.reminders.getExpiredReminders(this.plugin.settings.reminderTime.value);

    let previousReminder: Reminder | undefined = undefined;
    for (const reminder of expired) {
      if (this.plugin.app.workspace.layoutReady) {
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
        this.plugin.ui.showReminder(reminder);
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
