import { App, Modal } from "obsidian";
import type { Reminder } from "../model/reminder";
import ReminderView from "./components/Reminder.svelte";
import { inMinutes } from "../model/time";
import type { DateTime } from "model/time";
import { ReadOnlyReference } from "model/ref";
const electron = require("electron");

export class ReminderModal {

  constructor(private app: App, private useSystemNotification: ReadOnlyReference<boolean>) { }

  public show(
    reminder: Reminder,
    onRemindMeLater: (time: DateTime) => void,
    onDone: () => void
  ) {
    if (!this.isSystemNotification()) {
      this.showBuiltinReminder(reminder, onRemindMeLater, onDone);
    } else {
      // Show system notification
      const Notification = electron.remote.Notification;
      const n = new Notification({
        title: "Obsidian Reminder",
        body: reminder.title,
      });
      n.show();
      n.on("click", () => {
        n.close();
        this.showBuiltinReminder(reminder, onRemindMeLater, onDone);
      });
    }
  }

  private showBuiltinReminder(
    reminder: Reminder,
    onRemindMeLater: (time: DateTime) => void,
    onDone: () => void
  ) {
    new NotificationModal(this.app, reminder, onRemindMeLater, onDone).open();
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
  reminder: Reminder;
  onRemindMeLater: (time: DateTime) => void;
  onDone: () => void;
  canceled: boolean = true;

  constructor(
    app: App,
    reminder: Reminder,
    onRemindMeLater: (time: DateTime) => void,
    onDone: () => void
  ) {
    super(app);
    this.reminder = reminder;
    this.onRemindMeLater = onRemindMeLater;
    this.onDone = onDone;
  }

  onOpen() {
    let { contentEl } = this;
    new ReminderView({
      target: contentEl,
      props: {
        reminder: this.reminder,
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
      this.onRemindMeLater(inMinutes(10)());
    }
  }
}
