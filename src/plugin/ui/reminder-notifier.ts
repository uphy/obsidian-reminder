import type { ReadOnlyReference } from "model/ref";
import type { Reminder } from "model/reminder";
import type { Later } from "model/time";
import type { App } from "obsidian";
import type { ReminderActions } from "./reminder-actions";
import { NotificationModal } from "./reminder-modal";
import { ReminderToastManager } from "./reminder-toast";
import { SystemNotifier } from "./system-notification";

/**
 * Picks which surface(s) a reminder is shown on -- toast, popup modal,
 * and/or OS-level system notification -- and orchestrates their shared
 * lifecycle (`sync()`/`destroy()`).
 */
export class ReminderNotifier {
  private toastManager: ReminderToastManager = new ReminderToastManager();
  private systemNotifier: SystemNotifier;

  constructor(
    private app: App,
    private useSystemNotification: ReadOnlyReference<boolean>,
    private laters: ReadOnlyReference<Array<Later>>,
    openNoteOnReminderClick: ReadOnlyReference<boolean>,
    private showPopupWithSystemNotification: ReadOnlyReference<boolean>,
    keepSystemNotificationOnScreen: ReadOnlyReference<boolean>,
    private focusDoneButtonOnPopup: ReadOnlyReference<boolean>,
    private notificationPopupStyle: ReadOnlyReference<string>,
  ) {
    this.systemNotifier = new SystemNotifier(
      laters,
      openNoteOnReminderClick,
      keepSystemNotificationOnScreen,
      (reminder, actions) => this.showBuiltinReminder(reminder, actions),
    );
  }

  /** Unmounts every open toast and closes every tracked system notification (for plugin unload). */
  destroy() {
    this.toastManager.destroy();
    this.systemNotifier.destroy();
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
    this.systemNotifier.sync(currentKeys);
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
    this.systemNotifier.show(reminder, actions, showBothSurfaces);
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
    if (!this.systemNotifier.isAvailable()) {
      return false;
    }
    return this.useSystemNotification.value;
  }
}
