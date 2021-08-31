import { App, Modal } from "obsidian";
import type { Reminder } from "../model/reminder";
import ReminderView from "./components/Reminder.svelte";
import { inMinutes, Later } from "../model/time";
import type { DateTime } from "model/time";
import { ReadOnlyReference } from "model/ref";
import { SETTINGS } from "settings";
const electron = require("electron");

export class ReminderModal {

  constructor(private app: App, private useSystemNotification: ReadOnlyReference<boolean>, private laters: ReadOnlyReference<Array<Later>>) { }

  public show(
    reminder: Reminder,
    onRemindMeLater: (time: DateTime) => void,
    onDone: () => void,
  ) {
    const onCancel = () => {
      onRemindMeLater(inMinutes(10)());
    };

    if (!this.isSystemNotification()) {
      this.showBuiltinReminder(reminder, onRemindMeLater, onDone, onCancel);
    } else {
      // Show system notification
      const Notification = electron.remote.Notification;
      const n = new Notification({
        title: "Obsidian Reminder",
        body: reminder.title,
      });
      n.on("click", () => {
        n.close();
        this.showBuiltinReminder(reminder, onRemindMeLater, onDone, onCancel);
      });
      n.on("close", () => {
        onCancel();
      });
      // Only for macOS
      {
        const laters = SETTINGS.laters.value;
        n.on("action", (_, index) => {
          if (index === 0) {
            onDone();
            return;
          }
          const later = laters[index - 1];
          onRemindMeLater(later.later());
        });
        const actions = [{ type: "button", text: "Mark as Done" }];
        laters.forEach(later => {
          actions.push({ type: "button", text: later.label })
        });
        n.actions = actions as any;
      }

      n.show();
    }
  }

  private showBuiltinReminder(
    reminder: Reminder,
    onRemindMeLater: (time: DateTime) => void,
    onDone: () => void,
    onCancel: () => void
  ) {
    new NotificationModal(this.app, this.laters.value, reminder, onRemindMeLater, onDone, onCancel).open();
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

  constructor(
    app: App,
    private laters: Array<Later>,
    private reminder: Reminder,
    private onRemindMeLater: (time: DateTime) => void,
    private onDone: () => void,
    private onCancel: () => void,
  ) {
    super(app);
  }

  onOpen() {
    let { contentEl } = this;
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
      },
    });
  }

  onClose() {
    let { contentEl } = this;
    contentEl.empty();
    if (this.canceled) {
      this.onCancel();
    }
  }
}
