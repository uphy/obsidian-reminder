import { App, Modal } from "obsidian";
import type { Reminder } from "../model/reminder";
import ReminderView from "./components/Reminder.svelte";
import type { Later } from "../model/time";
import type { DateTime } from "model/time";
import type { ReadOnlyReference } from "model/ref";
import { SETTINGS } from "settings";
const electron = require("electron");

export class ReminderModal {

  constructor(private app: App, private useSystemNotification: ReadOnlyReference<boolean>, private laters: ReadOnlyReference<Array<Later>>) { }

  public show(
    reminder: Reminder,
    onRemindMeLater: (time: DateTime) => void,
    onDone: () => void,
    onMute: () => void,
    onOpenFile: () => void
  ) {
    if (!this.isSystemNotification()) {
      this.showBuiltinReminder(reminder, onRemindMeLater, onDone, onMute, onOpenFile);
    } else {
      // Show system notification
      const Notification = electron.remote.Notification;
      const n = new Notification({
        title: "Obsidian Reminder",
        body: reminder.title,
      });
      n.on("click", () => {
        n.close();
        this.showBuiltinReminder(reminder, onRemindMeLater, onDone, onMute, onOpenFile);
      });
      n.on("close", () => {
        onMute();
      });
      // Only for macOS
      {
        const laters = SETTINGS.laters.value;
        n.on("action", (_, index) => {
          if (index === 0) {
            onDone();
            return;
          }
          const later = laters[index - 1]!;
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
    onCancel: () => void,
    onOpenFile: () => void
  ) {
    new NotificationModal(this.app, this.laters.value, reminder, onRemindMeLater, onDone, onCancel, onOpenFile).open();
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
    private onOpenFile: () => void
  ) {
    super(app);
  }

  override onOpen() {
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
        onOpenFile: () => {
          this.canceled = true;
          this.onOpenFile();
          this.close();
        },
      },
    });
  }

  override onClose() {
    let { contentEl } = this;
    contentEl.empty();
    if (this.canceled) {
      this.onCancel();
    }
  }
}
