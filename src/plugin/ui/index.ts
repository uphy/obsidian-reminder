import type ReminderPlugin from "main";
import type { ReadOnlyReference } from "model/ref";
import type { DateTime } from "model/time";
import type { Reminder } from "model/reminder";
import {
  App,
  MarkdownView,
  Notice,
  Platform,
  PluginSettingTab,
  TFile,
  WorkspaceLeaf,
} from "obsidian";
import { registerCommands } from "plugin/commands";
import { showPauseDurationChooser } from "plugin/dnd";
import { monkeyPatchConsole } from "plugin/obsidian-hack/obsidian-debug-mobile";
import { VIEW_TYPE_REMINDER_LIST } from "./constants";
import { DndStatusBar } from "./dnd-status-bar";
import { ReminderListItemViewProxy } from "./reminder-list";
import { AutoComplete } from "./autocomplete";
import type { AutoCompletableEditor } from "./autocomplete";
import { buildCodeMirrorPlugin } from "./editor-extension";
import { ReminderModal } from "./reminder";

export class ReminderPluginUI {
  private autoComplete: AutoComplete;
  private editDetector: EditDetector;
  private reminderModal: ReminderModal;
  private viewProxy: ReminderListItemViewProxy;
  private dndStatusBar: DndStatusBar;
  constructor(private plugin: ReminderPlugin) {
    this.viewProxy = new ReminderListItemViewProxy(
      this.plugin,
      // On select a reminder in the list
      (reminder) => {
        if (
          !this.plugin.settings.openNoteOnReminderClick.value &&
          reminder.muteNotification
        ) {
          this.showReminder(reminder);
          return;
        }
        // Callback is synchronous; opening the file is fire-and-forget here.
        void this.openReminderFile(reminder);
      },
    );
    this.autoComplete = new AutoComplete(
      plugin.settings.autoCompleteTrigger,
      plugin.settings.reminderTimeStep,
      plugin.settings.primaryFormat,
      plugin.settings.convertNonTaskLines,
    );
    this.editDetector = new EditDetector(plugin.settings.editDetectionSec);
    this.reminderModal = new ReminderModal(
      plugin.app,
      plugin.settings.useSystemNotification,
      plugin.settings.laters,
      plugin.settings.openNoteOnReminderClick,
      plugin.settings.showPopupWithSystemNotification,
    );
    this.dndStatusBar = new DndStatusBar(plugin);
  }

  onload() {
    this.dndStatusBar.onload();

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

  refreshDndStatusBar() {
    this.dndStatusBar.refresh();
  }

  private showReminderModal(
    reminder: Reminder,
    onRemindMeLater: (time: DateTime) => void,
    onDone: () => void,
    onMute: () => void,
    onOpenFile: () => void,
    onPauseAllNotifications: () => void,
    onMuteAll: () => void,
  ) {
    this.reminderModal.show(
      reminder,
      onRemindMeLater,
      onDone,
      onMute,
      onOpenFile,
      onPauseAllNotifications,
      onMuteAll,
    );
  }

  async showReminderList() {
    const workspace = this.plugin.app.workspace;
    let leaf = workspace.getLeavesOfType(VIEW_TYPE_REMINDER_LIST)[0];
    if (leaf == null) {
      const rightLeaf = workspace.getRightLeaf(false);
      if (rightLeaf == null) {
        return;
      }
      await rightLeaf.setViewState({
        type: VIEW_TYPE_REMINDER_LIST,
      });
      leaf = rightLeaf;
    }
    // Without revealing the leaf, the view stays hidden when the right
    // sidebar is collapsed or another view is on top of it.
    await workspace.revealLeaf(leaf);
  }

  private detachReminderList() {
    this.plugin.app.workspace
      .getLeavesOfType(VIEW_TYPE_REMINDER_LIST)
      .forEach((leaf) => leaf.detach());
  }

  private async openReminderFile(reminder: Reminder) {
    const leaf = this.plugin.app.workspace.getLeaf(false);

    console.debug("Open reminder: ", reminder);
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
        console.debug("Remind me later: time=%o", time);
        reminder.time = time;
        reminder.muteNotification = false;
        // Callback is synchronous; both calls are fire-and-forget here.
        void this.plugin.fileSystem.updateReminder(reminder, false);
        void this.plugin.data.save(true);
      },
      () => {
        console.debug("done");
        reminder.muteNotification = false;
        // Callback is synchronous; both calls are fire-and-forget here.
        void this.plugin.fileSystem.updateReminder(reminder, true);
        this.plugin.reminders.removeReminder(reminder);
        void this.plugin.data.save(true);
      },
      () => {
        console.debug("Mute");
        reminder.muteNotification = true;
        this.reload(true);
        void this.plugin.data.save(true);
      },
      () => {
        console.debug("Open");
        // Callback is synchronous; opening the file is fire-and-forget here.
        void this.openReminderFile(reminder);
      },
      () => {
        console.debug("Pause all notifications");
        // Unlike Mute, this must not leave this specific reminder muted:
        // pausing suppresses notifications globally without touching
        // individual reminders, so it re-fires once the pause ends.
        reminder.muteNotification = false;
        showPauseDurationChooser(this.plugin);
      },
      () => {
        console.debug("Mute all reminders");
        // +1 for the currently displayed reminder: it was already flagged
        // muted at display time (top of `showReminder()`), so
        // `muteExpiredReminders()` never counts it as newly muted, but from
        // the user's perspective this action is what mutes it.
        const count =
          this.plugin.reminders.muteExpiredReminders(
            this.plugin.settings.reminderTime.value,
          ) + 1;
        // Already covered by muteExpiredReminders() in the common case, but
        // set explicitly to stay correct even if this reminder's expiry
        // check races with the bulk mute above.
        reminder.muteNotification = true;
        this.reload(true);
        void this.plugin.data.save(true);
        new Notice(`Muted ${count} reminder${count === 1 ? "" : "s"}`);
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

  override display(): void {
    const { containerEl } = this;

    this.plugin.settings.settings.displayOn(containerEl);
  }
}
