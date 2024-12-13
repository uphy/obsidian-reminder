import { RemindersController } from "controller";
import { PluginDataIO } from "data";
import type { ReadOnlyReference } from "model/ref";
import { Reminder, Reminders } from "model/reminder";
import { DATE_TIME_FORMATTER } from "model/time";
import {
  App,
  Platform,
  Plugin,
  PluginManifest,
  WorkspaceLeaf
} from "obsidian";
import { monkeyPatchConsole } from "obsidian-hack/obsidian-debug-mobile";
import { ReminderSettingTab, SETTINGS } from "settings";
import { AutoComplete } from "ui/autocomplete";
import { DateTimeChooserView } from "ui/datetime-chooser";
import { openDateTimeFormatChooser } from "ui/datetime-format-modal";
import { buildCodeMirrorPlugin } from "ui/editor-extension";
import { ReminderModal } from "ui/reminder";
import { ReminderListItemViewProxy } from "ui/reminder-list";
import { ReminderStatus } from "model/format/reminder-base";
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
    this.setupUI();
    this.setupCommands();
    this.app.workspace.onLayoutReady(async () => {
      await this.pluginDataIO.load();
      if (this.pluginDataIO.debug.value) {
        monkeyPatchConsole(this);
      }
      this.watchVault();
      this.startPeriodicTask();
    })
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
    if (Platform.isDesktopApp) {
      this.registerEditorExtension(buildCodeMirrorPlugin(this.app, this.reminders));
      this.registerCodeMirror((cm: CodeMirror.Editor) => {
        const dateTimeChooser = new DateTimeChooserView(cm, this.reminders);
        cm.on(
          "change",
          (cmEditor: CodeMirror.Editor, changeObj: CodeMirror.EditorChange) => {
            if (!this.autoComplete.isTrigger(cmEditor, changeObj)) {
              dateTimeChooser.cancel();
              return;
            }
            dateTimeChooser.show()
              .then(value => {
                this.autoComplete.insert(cmEditor, value);
              })
              .catch(() => { /* do nothing on cancel */ });
            return;
          }
        );
      });
    }

    // Open reminder list view. This callback will fire immediately if the
    // layout is ready, and will otherwise be enqueued.
    this.app.workspace.onLayoutReady(() => {
      this.viewProxy.openView();
    });
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
      name: "Show calendar popup",
      icon: "calendar-with-checkmark",
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

        this.autoComplete.show(this.app, editor, this.reminders);
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
      this.app.vault.on("rename", async (file, oldPath) => {
        // We only reload the file if it CAN be deleted, otherwise this can
        // cause crashes.
        if (await this.remindersController.removeFile(oldPath)) {
          // We need to do the reload synchronously so as to avoid racing.
          await this.remindersController.reloadFile(file);
        }
      }),
    ].forEach(eventRef => {
      this.registerEvent(eventRef);
    })
  }

  private startPeriodicTask() {
    let intervalTaskRunning = true;
    // Force the view to refresh as soon as possible.
    this.periodicTask().finally(() => {
      intervalTaskRunning = false;
    });

    // Set up the recurring check for reminders.
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

    let previousReminder: Reminder | undefined = undefined;
    for (let reminder of expired) {
      if (this.app.workspace.layoutReady) {
        if (reminder.muteNotification) {
          // We don't want to set `previousReminder` in this case as the current
          // reminder won't be shown.
          continue;
        }
        if (previousReminder) {
          while(previousReminder.beingDisplayed) {
            // Displaying too many reminders at once can cause crashes on
            // mobile. We use `beingDisplayed` to wait for the current modal to
            // be dismissed before displaying the next.
            await this.sleep(100);
          }
        }
        this.showReminder(reminder);
        previousReminder = reminder;
      }
    }
  }

  /* An asynchronous sleep function. To use it you must `await` as it hands
   * off control to other portions of the JS control loop whilst waiting.
   *
   * @param milliseconds - The number of milliseconds to wait before resuming.
   */
  private async sleep(milliseconds: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, milliseconds));
  }

  private showReminder(reminder: Reminder) {
    reminder.muteNotification = true;
    this.reminderModal.show(
      reminder,
      (time) => {
        console.info("Remind me later: time=%o", time);
        reminder.time = time;
        reminder.muteNotification = false;
        this.remindersController.updateReminder(reminder, ReminderStatus.Todo);
        this.pluginDataIO.save(true);
      },
      () => {
        console.info("done");
        reminder.muteNotification = false;
        this.remindersController.updateReminder(reminder, ReminderStatus.Done);
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
