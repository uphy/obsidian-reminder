import {
  App,
  MarkdownEditView,
  MarkdownView,
  Modal,
  Notice,
  Plugin,
  PluginManifest,
  PluginSettingTab,
  Setting,
  SuggestModal,
  TAbstractFile,
  TFile,
  Vault,
  WorkspaceLeaf,
} from "obsidian";
import { VIEW_TYPE_REMINDER_LIST } from "./constants";
import { RemindersController } from "./controller";
import { PluginDataIO } from "./data";
import { Completion } from "./model/autocomplete";
import { Reminders } from "./model/reminder";
import { Laters } from "./model/time";
import { ReminderSettingTab } from "./settings";
import { AutoCompleteView } from "./ui/autocomplete";
import { showReminder } from "./ui/reminder";
import { ReminderListItemViewProxy } from "./ui/reminder-list";

export default class ReminderPlugin extends Plugin {
  pluginDataIO: PluginDataIO;
  private viewProxy: ReminderListItemViewProxy;
  private reminders: Reminders;
  private remindersController: RemindersController;
  private editDetector = new EditDetector();

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
    this.reminders.reminderTime = this.pluginDataIO.reminderTime;
    this.viewProxy = new ReminderListItemViewProxy(app.workspace, this.reminders, this.pluginDataIO.reminderTime,
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
      new ReminderSettingTab(this.app, this, this.pluginDataIO.reminderTime)
    );

    this.registerDomEvent(document, "keydown", (evt: KeyboardEvent) => {
      this.editDetector.fileChanged();
    });
    this.registerCodeMirror((cm: CodeMirror.Editor) => {
      const autoComplete = new AutoCompleteView(cm);
      cm.on(
        "change",
        (cmEditor: CodeMirror.Editor, changeObj: CodeMirror.EditorChange) => {
          this.showAutoCompletion(cmEditor, changeObj, autoComplete);
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
      this.pluginDataIO.reminderTime.value
    );
    const reminderNotifications = expired.map((reminder) => {
      return new Promise((resolve) => {
        showReminder(
          this.app,
          reminder,
          (time) => {
            console.info("Remind me later: time=%o", time);
            reminder.time = time;
            this.remindersController.updateReminder(reminder, false);
            this.pluginDataIO.save(true);
            resolve(null);
          },
          () => {
            console.info("done");
            this.remindersController.updateReminder(reminder, true);
            this.reminders.removeReminder(reminder);
            this.pluginDataIO.save(true);
            resolve(null);
          }
        );
      });
    });
    await Promise.all(reminderNotifications);
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

  private isAutoCompletionTrigger(cmEditor: CodeMirror.Editor, changeObj: CodeMirror.EditorChange): boolean {
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

  private showAutoCompletion(cmEditor: CodeMirror.Editor, changeObj: CodeMirror.EditorChange, autoComplete: AutoCompleteView): void {
    if (!this.isAutoCompletionTrigger(cmEditor, changeObj)) {
      return;
    }
    autoComplete.show(Laters.map(l => ({ title: l.label, completion: l.later().toString() }))).then(value => {
      cmEditor.replaceRange(value.completion as any, cmEditor.getCursor());
    }).catch(() => { /* do nothing on cancel */ });
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
