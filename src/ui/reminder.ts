import { App, Modal } from "obsidian";
import type { Reminder } from "../model/reminder";
import ReminderView from "./components/Reminder.svelte";
import { inMinutes } from "../model/time";
import type { DateTime } from "model/time";
const electron = require("electron");

export function isMobile() {
  return electron !== undefined;
}

function isBuiltinNotification() {
  if (isMobile()) {
    return true;
  }
  // TODO load from setting
  return true;
}

function showBuiltinReminder(
  app: App,
  reminder: Reminder,
  onRemindMeLater: (time: DateTime) => void,
  onDone: () => void
) {
  new NotificationModal(app, reminder, onRemindMeLater, onDone).open();
}

export function showReminder(
  app: App,
  reminder: Reminder,
  onRemindMeLater: (time: DateTime) => void,
  onDone: () => void
) {
  if (isBuiltinNotification()) {
    showBuiltinReminder(app, reminder, onRemindMeLater, onDone);
  } else {
    // Show system notification
    const Notification = electron.remote.Notification;
    const n = new Notification({
      title: "Obsidian Reminder",
      body: reminder.title,
    });
    n.show();
    n.on("click", () => {
      showBuiltinReminder(app, reminder, onRemindMeLater, onDone);
    });
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
