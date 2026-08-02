import type { Reminder } from "model/reminder";
import type { DateTime, Later } from "model/time";
import { App, Modal } from "obsidian";
import ReminderView from "ui/Reminder.svelte";
import type { ReminderActions } from "./reminder-actions";

export class NotificationModal extends Modal {
  canceled: boolean = true;
  // Set when the modal is closed via "Pause all notifications...". This
  // takes precedence over `canceled` in `onClose()` so `actions.mute()`
  // is skipped, letting the reminder re-fire once the pause ends.
  private pausingAll: boolean = false;
  // Set when the modal is closed via "Mute all reminders...". Like
  // `pausingAll`, this takes precedence over `canceled` in `onClose()` so
  // `actions.mute()` (single mute) is skipped -- muting all already covers
  // this reminder, so the single mute would be redundant.
  private mutingAll: boolean = false;

  constructor(
    app: App,
    private laters: Array<Later>,
    private reminder: Reminder,
    private actions: ReminderActions,
    private focusDoneButtonOnPopup: boolean,
  ) {
    super(app);
  }

  override onOpen() {
    // When the modal is opened we mark the reminder as being displayed. This
    // lets us introspect the reminder's display state from elsewhere.
    this.reminder.beingDisplayed = true;

    const { contentEl } = this;
    new ReminderView({
      target: contentEl,
      props: {
        reminder: this.reminder,
        laters: this.laters,
        focusDone: this.focusDoneButtonOnPopup,
        onRemindMeLater: (time: DateTime) => {
          this.actions.remindMeLater(time);
          this.canceled = false;
          this.close();
        },
        onDone: () => {
          this.canceled = false;
          this.actions.done();
          this.close();
        },
        onOpenFile: () => {
          this.canceled = true;
          this.actions.openFile();
          this.close();
        },
        onMute: () => {
          this.canceled = true;
          this.close();
        },
        onPauseAllNotifications: () => {
          this.pausingAll = true;
          this.actions.pauseAll();
          this.close();
        },
        onMuteAll: () => {
          this.mutingAll = true;
          this.actions.muteAll();
          this.close();
        },
      },
    });
  }

  override onClose() {
    // Unset the reminder from being displayed. This lets other parts of the
    // plugin continue.
    this.reminder.beingDisplayed = false;
    const { contentEl } = this;
    contentEl.empty();
    if (this.pausingAll) {
      // Skip `actions.mute()`: pausing suppresses notifications globally
      // without muting this specific reminder.
    } else if (this.mutingAll) {
      // Skip `actions.mute()` (single mute): muting all already covers this
      // reminder.
    } else if (this.canceled) {
      this.actions.mute();
    }
  }
}
