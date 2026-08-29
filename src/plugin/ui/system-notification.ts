import type { ReadOnlyReference } from "model/ref";
import type { Reminder } from "model/reminder";
import type { Later } from "model/time";
import type { ReminderActions } from "./reminder-actions";
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

/**
 * Shows and tracks Electron's OS-level notifications for reminders. All
 * Electron dependence (`window.require("electron")`) is confined to this
 * file -- callers only see `isAvailable()`, `show()`, `sync()`, and
 * `destroy()`.
 */
export class SystemNotifier {
  private systemNotifications: Map<string, TrackedSystemNotification> =
    new Map();

  constructor(
    private laters: ReadOnlyReference<Array<Later>>,
    private openNoteOnReminderClick: ReadOnlyReference<boolean>,
    private keepSystemNotificationOnScreen: ReadOnlyReference<boolean>,
    // Invoked when the user interacts with a non-alert-only notification in
    // a way that should fall back to the builtin toast/modal (e.g. clicking
    // it while "open note on click" is disabled). Kept as an injected
    // callback rather than a direct dependency so this file doesn't need to
    // know about the toast/modal orchestration in ReminderNotifier.
    private showBuiltinReminder: (
      reminder: Reminder,
      actions: ReminderActions,
    ) => void,
  ) {}

  /** True on desktop, where Electron (and thus system notifications) is available; false on mobile. */
  isAvailable(): boolean {
    return electron !== undefined;
  }

  show(reminder: Reminder, actions: ReminderActions, alertOnly: boolean) {
    const key = reminder.key();
    // Replace rather than stack a second notification for the same reminder
    // (e.g. it expires again before the previous notification was
    // dismissed), mirroring how the toast manager replaces existing toasts
    // by key.
    this.close(key);

    const Notification = electron.remote.Notification;
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
      // helper (which skips `actions.mute()`) matches the previous plain
      // `n.close()` call.
      this.close(key);
      if (this.openNoteOnReminderClick.value) {
        actions.openFile();
        return;
      }
      if (!alertOnly) {
        this.showBuiltinReminder(reminder, actions);
      }
    });
    n.on("close", () => {
      // For a plugin-initiated close, close() already removed the map entry
      // (see its docstring). This only has an effect for a genuine user
      // dismissal, where the entry is still present.
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
        n.on("action", (_: unknown, index: number) => {
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

  /** Closes every tracked system notification (for plugin unload). */
  destroy() {
    for (const key of Array.from(this.systemNotifications.keys())) {
      this.close(key);
    }
    this.systemNotifications.clear();
  }

  /**
   * Closes system notifications whose reminder key is no longer present in
   * the current data -- e.g. the reminder was marked done or snoozed on
   * another device and synced in, its date was edited into the future, the
   * line was deleted, or the task was checked off directly in the file.
   */
  sync(currentKeys: Set<string>) {
    for (const key of Array.from(this.systemNotifications.keys())) {
      if (!currentKeys.has(key)) {
        this.close(key);
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
  private close(key: string) {
    const tracked = this.systemNotifications.get(key);
    if (!tracked) {
      return;
    }
    tracked.closedByPlugin = true;
    this.systemNotifications.delete(key);
    tracked.notification.close();
  }
}
