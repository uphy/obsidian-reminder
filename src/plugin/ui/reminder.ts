import type { ReadOnlyReference } from "model/ref";
import type { Reminder } from "model/reminder";
import type { DateTime, Later } from "model/time";
import { App, Modal } from "obsidian";
import ReminderView from "ui/Reminder.svelte";
const electron = window.require ? window.require("electron") : undefined;

export class ReminderModal {
  constructor(
    private app: App,
    private useSystemNotification: ReadOnlyReference<boolean>,
    private laters: ReadOnlyReference<Array<Later>>,
    private openNoteOnReminderClick: ReadOnlyReference<boolean>,
    private showPopupWithSystemNotification: ReadOnlyReference<boolean>,
  ) {}

  public show(
    reminder: Reminder,
    onRemindMeLater: (time: DateTime) => void,
    onDone: () => void,
    onMute: () => void,
    onOpenFile: () => void,
    onPauseAllNotifications: () => void,
    onMuteAll: () => void,
  ) {
    if (!this.isSystemNotification()) {
      this.showBuiltinReminder(
        reminder,
        onRemindMeLater,
        onDone,
        onMute,
        onOpenFile,
        onPauseAllNotifications,
        onMuteAll,
      );
      return;
    }

    const showBothSurfaces = this.showPopupWithSystemNotification.value;
    if (showBothSurfaces) {
      // The popup is the single owner of the reminder's lifecycle in this
      // mode, so the system notification must not also wire up mute/done
      // actions -- otherwise both surfaces would fire onDone/onMute for the
      // same reminder. It is shown as an alert only.
      this.showBuiltinReminder(
        reminder,
        onRemindMeLater,
        onDone,
        onMute,
        onOpenFile,
        onPauseAllNotifications,
        onMuteAll,
      );
    }
    this.showSystemNotification(
      reminder,
      onRemindMeLater,
      onDone,
      onMute,
      onOpenFile,
      onPauseAllNotifications,
      onMuteAll,
      showBothSurfaces,
    );
  }

  private showSystemNotification(
    reminder: Reminder,
    onRemindMeLater: (time: DateTime) => void,
    onDone: () => void,
    onMute: () => void,
    onOpenFile: () => void,
    onPauseAllNotifications: () => void,
    onMuteAll: () => void,
    alertOnly: boolean,
  ) {
    const Notification = (electron as any).remote.Notification;
    const n = new Notification({
      title: "Obsidian Reminder",
      body: reminder.title,
    });
    n.on("click", () => {
      n.close();
      if (this.openNoteOnReminderClick.value) {
        onOpenFile();
        return;
      }
      if (!alertOnly) {
        this.showBuiltinReminder(
          reminder,
          onRemindMeLater,
          onDone,
          onMute,
          onOpenFile,
          onPauseAllNotifications,
          onMuteAll,
        );
      }
    });
    if (!alertOnly) {
      n.on("close", () => {
        onMute();
      });
      // Only for macOS
      {
        const laters = this.laters.value;
        n.on("action", (_: any, index: any) => {
          if (index === 0) {
            onDone();
            return;
          }
          const later = laters[index - 1]!;
          onRemindMeLater(later.later());
        });
        const actions = [{ type: "button", text: "Mark as Done" }];
        laters.forEach((later) => {
          actions.push({ type: "button", text: later.label });
        });
        n.actions = actions as any;
      }
    }

    n.show();
  }

  private showBuiltinReminder(
    reminder: Reminder,
    onRemindMeLater: (time: DateTime) => void,
    onDone: () => void,
    onCancel: () => void,
    onOpenFile: () => void,
    onPauseAllNotifications: () => void,
    onMuteAll: () => void,
  ) {
    new NotificationModal(
      this.app,
      this.laters.value,
      reminder,
      onRemindMeLater,
      onDone,
      onCancel,
      onOpenFile,
      onPauseAllNotifications,
      onMuteAll,
    ).open();
  }

  private isSystemNotification() {
    if (this.isMobile()) {
      return false;
    }
    return this.useSystemNotification.value;
  }

  private isMobile() {
    return electron === undefined;
  }
}

class NotificationModal extends Modal {
  canceled: boolean = true;
  // Set when the modal is closed via "Pause all notifications...". This
  // takes precedence over `canceled` in `onClose()` so `onCancel` (which
  // mutes the reminder) is skipped, letting the reminder re-fire once the
  // pause ends.
  private pausingAll: boolean = false;
  // Set when the modal is closed via "Mute all reminders...". Like
  // `pausingAll`, this takes precedence over `canceled` in `onClose()` so
  // `onCancel` (single mute) is skipped -- muting all already covers this
  // reminder, so the single mute would be redundant.
  private mutingAll: boolean = false;

  constructor(
    app: App,
    private laters: Array<Later>,
    private reminder: Reminder,
    private onRemindMeLater: (time: DateTime) => void,
    private onDone: () => void,
    private onCancel: () => void,
    private onOpenFile: () => void,
    private onPauseAllNotifications: () => void,
    private onMuteAll: () => void,
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
        onRemindMeLater: (time: DateTime) => {
          this.onRemindMeLater(time);
          this.canceled = false;
          this.close();
        },
        onDone: () => {
          this.canceled = false;
          this.onDone();
          this.close();
        },
        onOpenFile: () => {
          this.canceled = true;
          this.onOpenFile();
          this.close();
        },
        onMute: () => {
          this.canceled = true;
          this.close();
        },
        onPauseAllNotifications: () => {
          this.pausingAll = true;
          this.onPauseAllNotifications();
          this.close();
        },
        onMuteAll: () => {
          this.mutingAll = true;
          this.onMuteAll();
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
      // Skip `onCancel` (mute): pausing suppresses notifications globally
      // without muting this specific reminder.
    } else if (this.mutingAll) {
      // Skip `onCancel` (single mute): muting all already covers this
      // reminder.
    } else if (this.canceled) {
      this.onCancel();
    }
  }
}
