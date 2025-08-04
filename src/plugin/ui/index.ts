import type ReminderPlugin from "main";
import type { ReadOnlyReference } from "model/ref";
import type { DateTime } from "model/time";
import type { Reminder } from "model/reminder";
import {
  App,
  MarkdownView,
  Platform,
  PluginSettingTab,
  TFile,
  WorkspaceLeaf,
} from "obsidian";
import { registerCommands } from "plugin/commands";
import { monkeyPatchConsole } from "plugin/obsidian-hack/obsidian-debug-mobile";
import { VIEW_TYPE_REMINDER_LIST } from "./constants";
import { ReminderListItemViewProxy } from "./reminder-list";
import { AutoComplete } from "./autocomplete";
import type { AutoCompletableEditor } from "./autocomplete";
import { buildCodeMirrorPlugin } from "./editor-extension";
import { ReminderModal } from "./reminder";
import { createReminderPillExtension } from "./editor-reminder-display";

export class ReminderPluginUI {
  private autoComplete: AutoComplete;
  private editDetector: EditDetector;
  private reminderModal: ReminderModal;
  private viewProxy: ReminderListItemViewProxy;
  constructor(private plugin: ReminderPlugin) {
    this.viewProxy = new ReminderListItemViewProxy(
      this.plugin,
      // On select a reminder in the list
      (reminder) => {
        if (reminder.muteNotification) {
          this.showReminder(reminder);
          return;
        }
        this.openReminderFile(reminder);
      },
    );
    this.autoComplete = new AutoComplete(
      plugin.settings.autoCompleteTrigger,
      plugin.settings.reminderTimeStep,
      plugin.settings.primaryFormat,
    );
    this.editDetector = new EditDetector(plugin.settings.editDetectionSec);
    this.reminderModal = new ReminderModal(
      plugin.app,
      plugin.settings.useSystemNotification,
      plugin.settings.laters,
    );
  }

  onload() {
    // Reminder List
    this.plugin.registerView(VIEW_TYPE_REMINDER_LIST, (leaf: WorkspaceLeaf) => {
      return this.viewProxy.createView(leaf);
    });
    this.plugin.addSettingTab(
      new ReminderSettingTab(this.plugin.app, this.plugin),
    );

    this.plugin.registerDomEvent(document, "keydown", () => {
      this.editDetector.fileChanged();
    });
    if (Platform.isDesktopApp) {
      this.plugin.registerEditorExtension(
        buildCodeMirrorPlugin(
          this.plugin.app,
          this.plugin.reminders,
          this.plugin.settings,
        ),
      );
      this.plugin.registerEditorExtension(
        createReminderPillExtension(this.plugin.app),
      );
    }

    registerCommands(this.plugin);
  }

  onLayoutReady() {
    if (this.plugin.data.debug.value) {
      monkeyPatchConsole(this.plugin);
    }

    // Open reminder list view. This callback will fire immediately if the
    // layout is ready, and will otherwise be enqueued.
    this.viewProxy.openView();
  }

  onunload() {
    this.detachReminderList();
  }

  isEditing(): boolean {
    return this.editDetector.isEditing();
  }

  invalidate() {
    this.viewProxy.invalidate();
  }

  reload(force: boolean = false) {
    this.viewProxy.reload(force);
  }

  showAutoComplete(editor: AutoCompletableEditor) {
    this.autoComplete.show(this.plugin.app, editor, this.plugin.reminders);
  }

  private showReminderModal(
    reminder: Reminder,
    onRemindMeLater: (time: DateTime) => void,
    onDone: () => void,
    onMute: () => void,
    onOpenFile: () => void,
  ) {
    this.reminderModal.show(
      reminder,
      onRemindMeLater,
      onDone,
      onMute,
      onOpenFile,
    );
  }

  showReminderList() {
    if (
      this.plugin.app.workspace.getLeavesOfType(VIEW_TYPE_REMINDER_LIST).length
    ) {
      return;
    }
    this.plugin.app.workspace.getRightLeaf(false)?.setViewState({
      type: VIEW_TYPE_REMINDER_LIST,
    });
  }

  private detachReminderList() {
    this.plugin.app.workspace
      .getLeavesOfType(VIEW_TYPE_REMINDER_LIST)
      .forEach((leaf) => leaf.detach());
  }

  private async openReminderFile(reminder: Reminder) {
    const leaf = this.plugin.app.workspace.getLeaf(false);

    console.log("Open reminder: ", reminder);
    const file = this.plugin.app.vault.getAbstractFileByPath(reminder.file);
    if (!(file instanceof TFile)) {
      console.error("Cannot open file because it isn't a TFile: %o", file);
      return;
    }

    // Open the reminder file and select the reminder
    await leaf.openFile(file);
    if (!(leaf.view instanceof MarkdownView)) {
      return;
    }
    const line = leaf.view.editor.getLine(reminder.rowNumber);
    leaf.view.editor.setSelection(
      {
        line: reminder.rowNumber,
        ch: 0,
      },
      {
        line: reminder.rowNumber,
        ch: line.length,
      },
    );
  }

  showReminder(reminder: Reminder) {
    reminder.muteNotification = true;
    this.showReminderModal(
      reminder,
      (time) => {
        console.info("Remind me later: time=%o", time);
        reminder.time = time;
        reminder.muteNotification = false;
        this.plugin.fileSystem.updateReminder(reminder, false);
        this.plugin.data.save(true);
      },
      () => {
        console.info("done");
        reminder.muteNotification = false;
        this.plugin.fileSystem.updateReminder(reminder, true);
        this.plugin.reminders.removeReminder(reminder);
        this.plugin.data.save(true);
      },
      () => {
        console.info("Mute");
        reminder.muteNotification = true;
        this.reload(true);
      },
      () => {
        console.info("Open");
        this.openReminderFile(reminder);
      },
    );
  }
}

class EditDetector {
  private lastModified?: Date;

  constructor(private editDetectionSec: ReadOnlyReference<number>) {}

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

export class ReminderSettingTab extends PluginSettingTab {
  constructor(
    app: App,
    private plugin: ReminderPlugin,
  ) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;

    this.plugin.settings.settings.displayOn(containerEl);
  }
}
