import type { ReadOnlyReference } from "model/ref";
import type { Reminder } from "model/reminder";
import type { DateTime, Later } from "model/time";
import { App, Modal } from "obsidian";
import ReminderView from "ui/Reminder.svelte";
import type { ReminderActions } from "./reminder-actions";
import { ReminderToastManager } from "./reminder-toast";
const electron = window.require ? window.require("electron") : undefined;

/** A system notification tracked so it can be dismissed programmatically. */
interface TrackedSystemNotification {
  notification: { close: () => void };
  // Set right before we call `notification.close()` ourselves (e.g. from
  // `sync()`/`destroy()`, or replacing a stale notification for the same
  // key), so the "close" event handler can tell that apart from the user
  // dismissing the notification and skip calling `actions.mute()` again --
  // `showReminder()` already marks the reminder muted at display time, so a
  // second `actions.mute()` call would just trigger a redundant
  // reload()/save().
  closedByPlugin: boolean;
}

export class ReminderModal {
  private toastManager: ReminderToastManager = new ReminderToastManager();
  private systemNotifications: Map<string, TrackedSystemNotification> =
    new Map();

  constructor(
    private app: App,
    private useSystemNotification: ReadOnlyReference<boolean>,
    private laters: ReadOnlyReference<Array<Later>>,
    private openNoteOnReminderClick: ReadOnlyReference<boolean>,
    private showPopupWithSystemNotification: ReadOnlyReference<boolean>,
    private keepSystemNotificationOnScreen: ReadOnlyReference<boolean>,
    private focusDoneButtonOnPopup: ReadOnlyReference<boolean>,
    private notificationPopupStyle: ReadOnlyReference<string>,
  ) {}

  /** Unmounts every open toast and closes every tracked system notification (for plugin unload). */
  destroy() {
    this.toastManager.destroy();
    for (const key of Array.from(this.systemNotifications.keys())) {
      this.closeSystemNotification(key);
    }
    this.systemNotifications.clear();
  }

  /**
   * Removes toasts and closes system notifications whose reminder key is no
   * longer present in the current data -- e.g. the reminder was marked done
   * or snoozed on another device and synced in, its date was edited into the
   * future, the line was deleted, or the task was checked off directly in
   * the file.
   */
  sync(currentKeys: Set<string>) {
    this.toastManager.sync(currentKeys);
    for (const key of Array.from(this.systemNotifications.keys())) {
      if (!currentKeys.has(key)) {
        this.closeSystemNotification(key);
      }
    }
  }

  /**
   * Closes the tracked system notification for `key`, if any, marking it as
   * closed by the plugin so the "close" event handler doesn't treat it as a
   * user dismissal.
   *
   * Removes the map entry immediately rather than waiting for the "close"
   * event: on Windows, once a notification has moved from the screen to the
   * action center, `close()` is a no-op and never fires "close", which would
   * otherwise leak this entry forever.
   */
  private closeSystemNotification(key: string) {
    const tracked = this.systemNotifications.get(key);
    if (!tracked) {
      return;
    }
    tracked.closedByPlugin = true;
    this.systemNotifications.delete(key);
    tracked.notification.close();
  }

  public show(reminder: Reminder, actions: ReminderActions) {
    if (!this.isSystemNotification()) {
      this.showBuiltinReminder(reminder, actions);
      return;
    }

    const showBothSurfaces = this.showPopupWithSystemNotification.value;
    if (showBothSurfaces) {
      // The popup is the single owner of the reminder's lifecycle in this
      // mode, so the system notification must not also wire up mute/done
      // actions -- otherwise both surfaces would fire onDone/onMute for the
      // same reminder. It is shown as an alert only.
      this.showBuiltinReminder(reminder, actions);
    }
    this.showSystemNotification(reminder, actions, showBothSurfaces);
  }

  private showSystemNotification(
    reminder: Reminder,
    actions: ReminderActions,
    alertOnly: boolean,
  ) {
    const key = reminder.key();
    // Replace rather than stack a second notification for the same reminder
    // (e.g. it expires again before the previous notification was
    // dismissed), mirroring how the toast manager replaces existing toasts
    // by key.
    this.closeSystemNotification(key);

    const Notification = (electron as any).remote.Notification;
    const n = new Notification({
      title: "Obsidian Reminder",
      body: reminder.title,
      // "never" keeps the notification on screen (Windows/Linux only, see
      // Electron docs -- ignored on macOS) until the user interacts with
      // it, which is required for `notification.close()` to be able to
      // dismiss it once it has moved to the notification center/action
      // center. With "default", close() only works while the notification
      // is still on screen.
      timeoutType: this.keepSystemNotificationOnScreen.value
        ? "never"
        : "default",
    });
    const tracked: TrackedSystemNotification = {
      notification: n,
      closedByPlugin: false,
    };
    this.systemNotifications.set(key, tracked);

    n.on("click", () => {
      // Not a behavior change: `showReminder()` already marks the reminder
      // muted before displaying it, so routing this through the shared
      // helper (which skips `onMute()`) matches the previous plain
      // `n.close()` call.
      this.closeSystemNotification(key);
      if (this.openNoteOnReminderClick.value) {
        actions.openFile();
        return;
      }
      if (!alertOnly) {
        this.showBuiltinReminder(reminder, actions);
      }
    });
    n.on("close", () => {
      // For a plugin-initiated close, closeSystemNotification() already
      // removed the map entry (see its docstring). This only has an effect
      // for a genuine user dismissal, where the entry is still present.
      if (this.systemNotifications.get(key) === tracked) {
        this.systemNotifications.delete(key);
      }
      if (alertOnly || tracked.closedByPlugin) {
        return;
      }
      actions.mute();
    });
    if (!alertOnly) {
      // Only for macOS
      {
        const laters = this.laters.value;
        n.on("action", (_: any, index: any) => {
          if (index === 0) {
            actions.done();
            return;
          }
          const later = laters[index - 1]!;
          actions.remindMeLater(later.later());
        });
        const notificationActions = [{ type: "button", text: "Mark as Done" }];
        laters.forEach((later) => {
          notificationActions.push({ type: "button", text: later.label });
        });
        n.actions = notificationActions as any;
      }
    }

    n.show();
  }

  private showBuiltinReminder(reminder: Reminder, actions: ReminderActions) {
    if (this.notificationPopupStyle.value === "toast") {
      this.toastManager.show(reminder, this.laters.value, actions);
      return;
    }
    new NotificationModal(
      this.app,
      this.laters.value,
      reminder,
      actions,
      this.focusDoneButtonOnPopup.value,
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
