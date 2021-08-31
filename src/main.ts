import { DATE_TIME_FORMATTER } from "model/time";
import {
  App,
  MarkdownView,
  Plugin,
  PluginManifest,
  WorkspaceLeaf,
} from "obsidian";
import { openDateTimeFormatChooser } from "ui/datetime-format-modal";
import { OkCancel, showOkCancelDialog } from "ui/util";
import { VIEW_TYPE_REMINDER_LIST } from "./constants";
import { RemindersController } from "./controller";
import { PluginDataIO } from "./data";
import { Reminders } from "./model/reminder";
import { ReminderSettingTab, SETTINGS } from "./settings";
import { DateTimeChooserModal, DateTimeChooserView } from "./ui/datetime-chooser";
import { ReminderModal } from "./ui/reminder";
import { ReminderListItemViewProxy } from "./ui/reminder-list";

export default class ReminderPlugin extends Plugin {
  pluginDataIO: PluginDataIO;
  private viewProxy: ReminderListItemViewProxy;
  private reminders: Reminders;
  private remindersController: RemindersController;
  private editDetector = new EditDetector();
  private reminderModal: ReminderModal;

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
    DATE_TIME_FORMATTER.setTimeFormat(SETTINGS.dateFormat, SETTINGS.dateTimeFormat);
    this.viewProxy = new ReminderListItemViewProxy(app.workspace, this.reminders, SETTINGS.reminderTime,
      // On select a reminder in the list
      (reminder) => {
        const leaf = this.app.workspace.getUnpinnedLeaf();
        this.remindersController.openReminder(reminder, leaf);
      });
    this.remindersController = new RemindersController(
      app.vault,
      this.viewProxy,
      this.reminders
    );
    this.reminderModal = new ReminderModal(this.app, SETTINGS.useSystemNotification, SETTINGS.laters);
  }

  async onload() {
    await this.pluginDataIO.load();
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
          if (!this.isDateTimeChooserTrigger(cmEditor, changeObj)) {
            dateTimeChooser.cancel();
            return;
          }
          this.showDateTimeChooser(cmEditor, dateTimeChooser);
          return false;
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
      checkCallback: (checking: boolean) => {
        const view = this.app.workspace.activeLeaf.view;
        if (!(view instanceof MarkdownView)) {
          return false;
        }
        if (!checking) {
          const cm: CodeMirror.Editor = (view.editor as any).cm;
          const v = new DateTimeChooserView(cm, this.reminders);
          this.showDateTimeChooser(cm, v);
        }
        return true;
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
      }, 5000)
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
    expired.map((reminder) => {
      if (reminder.notificationVisible) {
        return;
      }
      reminder.notificationVisible = true;
      this.reminderModal.show(
        reminder,
        (time) => {
          console.info("Remind me later: time=%o", time);
          reminder.time = time;
          reminder.notificationVisible = false;
          this.remindersController.updateReminder(reminder, false);
          this.pluginDataIO.save(true);
        },
        () => {
          console.info("done");
          reminder.notificationVisible = false;
          this.remindersController.updateReminder(reminder, true);
          this.reminders.removeReminder(reminder);
          this.pluginDataIO.save(true);
        },
      );
    });
  }

  onunload(): void {
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

  private isDateTimeChooserTrigger(cmEditor: CodeMirror.Editor, changeObj: CodeMirror.EditorChange): boolean {
    if (changeObj.text.contains("@")) {
      const prev = cmEditor.getRange({
        ch: changeObj.from.ch - 1,
        line: changeObj.from.line
      }, changeObj.from);
      if (prev === "(") {
        const line = cmEditor.getLine(changeObj.from.line);
        if (line.match(/^\s*\- \[.\]\s.*/)) {
          // is a TODO line
          return true;
        }
      }
    }
    return false;
  }

  private showDateTimeChooser(cmEditor: CodeMirror.Editor, dateTimeChooserView: DateTimeChooserView): void {
    dateTimeChooserView.show()
      .then(value => {
        cmEditor.replaceRange(DATE_TIME_FORMATTER.toString(value), cmEditor.getCursor());
      })
      .catch(() => { /* do nothing on cancel */ });
  }
}

class EditDetector {
  private lastModified: Date = null;

  fileChanged() {
    this.lastModified = new Date();
  }

  isEditing(): boolean {
    if (this.lastModified === null) {
      return false;
    }
    const elapsedSec =
      (new Date().getTime() - this.lastModified.getTime()) / 1000;
    return elapsedSec < 10;
  }
}
