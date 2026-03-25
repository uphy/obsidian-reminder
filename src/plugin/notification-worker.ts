import type ReminderPlugin from "main";
import type { Reminder } from "model/reminder";

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
          console.log(
            "Skip reminder interval task because task is already running.",
          );
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

    if (!this.plugin.data.scanned.value) {
      this.plugin.fileSystem.reloadRemindersInAllFiles().then(() => {
        this.plugin.data.scanned.value = true;
        this.plugin.data.save();
      });
    }

    this.plugin.data.save(false);

    if (this.plugin.ui.isEditing()) {
      return;
    }

    const expired = this.plugin.reminders.getExpiredReminders(
      this.plugin.settings.reminderTime.value,
      {
        repeat: this.plugin.settings.repeatOverdue.value,
        intervalMin: this.plugin.settings.overdueIntervalMin.value
      }
    );

    let previousReminder: Reminder | undefined = undefined;
    for (const reminder of expired) {
      if (this.plugin.app.workspace.layoutReady) {



        const isRepeat = reminder.muteNotification &&
                         this.plugin.settings.repeatOverdue.value;

        if (reminder.muteNotification && !isRepeat) {
          continue;
        }

        if (previousReminder) {
          while (previousReminder.beingDisplayed) {
            await this.sleep(100);
          }
        }

        // Benachrichtigung anzeigen
        this.plugin.ui.showReminder(reminder);


        reminder.lastNotifiedTime = new Date().getTime();

        previousReminder = reminder;
      }
    }
  }

  private async sleep(milliseconds: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
  }
}
