import { RemindersController } from "controller";
import { PluginDataIO } from "data";
import type { ReadOnlyReference } from "model/ref";
import { Reminder, Reminders } from "model/reminder";
import { DATE_TIME_FORMATTER } from "model/time";
import {
  App,
  Plugin,
  PluginManifest,
  WorkspaceLeaf
} from "obsidian";
import { monkeyPatchConsole } from "obsidian-debug-mobile";
import { ReminderSettingTab, SETTINGS } from "settings";
import { AutoComplete } from "ui/autocomplete";
import { DateTimeChooserView } from "ui/datetime-chooser";
import { openDateTimeFormatChooser } from "ui/datetime-format-modal";
import { ReminderModal } from "ui/reminder";
import { ReminderListItemViewProxy } from "ui/reminder-list";
import { OkCancel, showOkCancelDialog } from "ui/util";
import { VIEW_TYPE_REMINDER_LIST } from "./constants";

export default class ReminderPlugin extends Plugin {
  pluginDataIO: PluginDataIO;
  private viewProxy: ReminderListItemViewProxy;
  private reminders: Reminders;
  private remindersController: RemindersController;
  private editDetector: EditDetector;
  private reminderModal: ReminderModal;
  private autoComplete: AutoComplete;

  constructor(app: App, manifest: PluginManifest) {
    super(app, manifest);
    this.reminders = new Reminders(() => {
      // on changed
      if (this.viewProxy) {
        this.viewProxy.invalidate();
      }
      this.pluginDataIO.changed = true;
    });
    this.pluginDataIO = new PluginDataIO(this, this.reminders);
    this.reminders.reminderTime = SETTINGS.reminderTime;
    DATE_TIME_FORMATTER.setTimeFormat(SETTINGS.dateFormat, SETTINGS.dateTimeFormat, SETTINGS.strictDateFormat);
    this.editDetector = new EditDetector(SETTINGS.editDetectionSec);
    this.viewProxy = new ReminderListItemViewProxy(app.workspace, this.reminders, SETTINGS.reminderTime,
      // On select a reminder in the list
      (reminder) => {
        if (reminder.muteNotification) {
          this.showReminder(reminder);
          return;
        }
        this.openReminderFile(reminder);
      });
    this.remindersController = new RemindersController(
      app.vault,
      this.viewProxy,
      this.reminders
    );
    this.reminderModal = new ReminderModal(this.app, SETTINGS.useSystemNotification, SETTINGS.laters);
    this.autoComplete = new AutoComplete(SETTINGS.autoCompleteTrigger);
  }

  override async onload() {
    await this.pluginDataIO.load();
    if (this.pluginDataIO.debug.value) {
      monkeyPatchConsole(this);
    }
    this.setupUI();
    this.setupCommands();
    this.watchVault();
    this.startPeriodicTask();
  }

  private setupUI() {
    // Reminder List
    this.registerView(VIEW_TYPE_REMINDER_LIST, (leaf: WorkspaceLeaf) => {
      return this.viewProxy.createView(leaf);
    });
    this.addSettingTab(
      new ReminderSettingTab(this.app, this)
    );

    this.registerDomEvent(document, "keydown", (evt: KeyboardEvent) => {
      this.editDetector.fileChanged();
    });
    this.registerCodeMirror((cm: CodeMirror.Editor) => {
      const dateTimeChooser = new DateTimeChooserView(cm, this.reminders);
      cm.on(
        "change",
        (cmEditor: CodeMirror.Editor, changeObj: CodeMirror.EditorChange) => {
          if (!this.autoComplete.isTrigger(cmEditor, changeObj)) {
            dateTimeChooser.cancel();
            return;
          }
          this.autoComplete.show(cmEditor, dateTimeChooser);
          return;
        }
      );
    });

    // Open reminder list view
    if (this.app.workspace.layoutReady) {
      this.viewProxy.openView();
    } else {
      (this.app.workspace as any).on("layout-ready", () => {
        this.viewProxy.openView();
      });
    }
  }

  private setupCommands() {
    this.addCommand({
      id: "scan-reminders",
      name: "Scan reminders",
      checkCallback: (checking: boolean) => {
        if (checking) {
          return true;
        }
        this.remindersController.reloadAllFiles();
        return true;
      },
    });

    this.addCommand({
      id: "show-reminders",
      name: "Show reminders",
      checkCallback: (checking: boolean) => {
        if (!checking) {
          this.showReminderList();
        }
        return true;
      },
    });

    this.addCommand({
      id: "convert-reminder-time-format",
      name: "Convert reminder time format",
      checkCallback: (checking: boolean) => {
        if (!checking) {
          showOkCancelDialog("Convert reminder time format", "This command rewrite reminder dates in all markdown files.  You should make a backup of your vault before you execute this.  May I continue to convert?").then((res) => {
            if (res !== OkCancel.OK) {
              return;
            }
            openDateTimeFormatChooser(this.app, (dateFormat, dateTimeFormat) => {
              this.remindersController.convertDateTimeFormat(dateFormat, dateTimeFormat)
                .catch(() => { /* ignore */ });
            });
          });
        }
        return true;
      },
    });

    this.addCommand({
      id: "show-date-chooser",
      name: "Show date chooser popup",
      hotkeys: [
        {
          modifiers: ["Meta", "Shift"],
          key: "2" // Shift + 2 = `@`
        }
      ],
      editorCheckCallback: (checking, editor): boolean | void => {
        if (checking) {
          return true;
        }
        const cm: CodeMirror.Editor = (editor as any).cm;
        if (cm == null) {
          console.error("Cannot get codemirror editor.")
          return;
        }

        const v = new DateTimeChooserView(cm, this.reminders);
        this.autoComplete.show(cm, v, true);
      },
    });
    this.addCommand({
      id: "toggle-checklist-status",
      name: "Toggle checklist status",
      hotkeys: [
        {
          modifiers: ["Meta", "Shift"],
          key: "Enter"
        }
      ],
      editorCheckCallback: (checking, editor, view): boolean | void => {
        if (checking) {
          return true;
        }
        this.remindersController.toggleCheck(view.file, editor.getCursor().line);
      },
    });
  }

  private watchVault() {
    [
      this.app.vault.on("modify", async (file) => {
        this.remindersController.reloadFile(file, true);
      }),
      this.app.vault.on("delete", (file) => {
        this.remindersController.removeFile(file.path);
      }),
      this.app.vault.on("rename", (file, oldPath) => {
        this.remindersController.removeFile(oldPath);
        this.remindersController.reloadFile(file);
      }),
    ].forEach(eventRef => {
      this.registerEvent(eventRef);
    })
  }

  private startPeriodicTask() {
    let intervalTaskRunning = false;
    this.registerInterval(
      window.setInterval(() => {
        if (intervalTaskRunning) {
          console.log(
            "Skip reminder interval task because task is already running."
          );
          return;
        }
        intervalTaskRunning = true;
        this.periodicTask().finally(() => {
          intervalTaskRunning = false;
        });
      }, SETTINGS.reminderCheckIntervalSec.value * 1000)
    );
  }

  private async periodicTask(): Promise<void> {
    this.viewProxy.reload(false);

    if (!this.pluginDataIO.scanned.value) {
      this.remindersController.reloadAllFiles().then(() => {
        this.pluginDataIO.scanned.value = true;
        this.pluginDataIO.save();
      });
    }

    this.pluginDataIO.save(false);

    if (this.editDetector.isEditing()) {
      return;
    }
    const expired = this.reminders.getExpiredReminders(
      SETTINGS.reminderTime.value
    );
    expired.forEach((reminder) => {
      if (reminder.muteNotification) {
        return;
      }
      this.showReminder(reminder);
    });
  }

  private showReminder(reminder: Reminder) {
    reminder.muteNotification = true;
    this.reminderModal.show(
      reminder,
      (time) => {
        console.info("Remind me later: time=%o", time);
        reminder.time = time;
        reminder.muteNotification = false;
        this.remindersController.updateReminder(reminder, false);
        this.pluginDataIO.save(true);
      },
      () => {
        console.info("done");
        reminder.muteNotification = false;
        this.remindersController.updateReminder(reminder, true);
        this.reminders.removeReminder(reminder);
        this.pluginDataIO.save(true);
      },
      () => {
        console.info("Mute");
        reminder.muteNotification = true;
        this.viewProxy.reload(true);
      },
      () => {
        console.info("Open");
        this.openReminderFile(reminder);
      }
    );
  }

  private async openReminderFile(reminder: Reminder) {
    const leaf = this.app.workspace.getUnpinnedLeaf();
    await this.remindersController.openReminder(reminder, leaf);
  }

  override onunload(): void {
    this.app.workspace
      .getLeavesOfType(VIEW_TYPE_REMINDER_LIST)
      .forEach((leaf) => leaf.detach());
  }

  showReminderList(): void {
    if (this.app.workspace.getLeavesOfType(VIEW_TYPE_REMINDER_LIST).length) {
      return;
    }
    this.app.workspace.getRightLeaf(false).setViewState({
      type: VIEW_TYPE_REMINDER_LIST,
    });
  }

}

class EditDetector {
  private lastModified?: Date;

  constructor(private editDetectionSec: ReadOnlyReference<number>) { }

  fileChanged() {
    this.lastModified = new Date();
  }

  isEditing(): boolean {
    if (this.editDetectionSec.value <= 0) {
      return false;
    }
    if (this.lastModified == null) {
      return false;
    }
    const elapsedSec =
      (new Date().getTime() - this.lastModified.getTime()) / 1000;
    return elapsedSec < this.editDetectionSec.value;
  }
}
