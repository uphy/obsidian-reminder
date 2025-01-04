import type ReminderPlugin from 'main';
import type { ReadOnlyReference } from 'model/ref';
import type { DateTime } from 'model/time';
import type { Reminder } from 'model/reminder';
import { MarkdownView, Platform, TFile, WorkspaceLeaf } from 'obsidian';
import { ReminderSettingTab, SETTINGS } from 'obsidian/settings';
import { VIEW_TYPE_REMINDER_LIST } from './constants';
import type { ReminderListItemViewProxy } from './reminder-list';
import { AutoCompletableEditor, AutoComplete } from './autocomplete';
import { DateTimeChooserView } from './datetime-chooser';
import { buildCodeMirrorPlugin } from './editor-extension';
import { ReminderModal } from './reminder';

export class ReminderPluginUI {
  private autoComplete: AutoComplete;
  private editDetector: EditDetector;
  private reminderModal: ReminderModal;

  constructor(private plugin: ReminderPlugin, private viewProxy: ReminderListItemViewProxy) {
    this.autoComplete = new AutoComplete(SETTINGS.autoCompleteTrigger, SETTINGS.reminderTimeStep);
    this.editDetector = new EditDetector(SETTINGS.editDetectionSec);
    this.reminderModal = new ReminderModal(this.plugin.app, SETTINGS.useSystemNotification, SETTINGS.laters);
  }

  onload() {
    // Reminder List
    this.plugin.registerView(VIEW_TYPE_REMINDER_LIST, (leaf: WorkspaceLeaf) => {
      return this.viewProxy.createView(leaf);
    });
    this.plugin.addSettingTab(new ReminderSettingTab(this.plugin.app, this.plugin));

    this.plugin.registerDomEvent(document, 'keydown', (evt: KeyboardEvent) => {
      this.editDetector.fileChanged();
    });
    if (Platform.isDesktopApp) {
      this.plugin.registerEditorExtension(buildCodeMirrorPlugin(this.plugin.app, this.plugin.reminders));
      this.plugin.registerCodeMirror((cm: CodeMirror.Editor) => {
        const dateTimeChooser = new DateTimeChooserView(cm, this.plugin.reminders);
        cm.on('change', (cmEditor: CodeMirror.Editor, changeObj: CodeMirror.EditorChange) => {
          if (!this.autoComplete.isTrigger(cmEditor, changeObj)) {
            dateTimeChooser.cancel();
            return;
          }
          dateTimeChooser
            .show()
            .then((value) => {
              this.autoComplete.insert(cmEditor, value);
            })
            .catch(() => {
              /* do nothing on cancel */
            });
          return;
        });
      });
    }

    // Open reminder list view. This callback will fire immediately if the
    // layout is ready, and will otherwise be enqueued.
    this.plugin.app.workspace.onLayoutReady(() => {
      this.viewProxy.openView();
    });
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

  showReminderModal(
    reminder: Reminder,
    onRemindMeLater: (time: DateTime) => void,
    onDone: () => void,
    onMute: () => void,
    onOpenFile: () => void,
  ) {
    this.reminderModal.show(reminder, onRemindMeLater, onDone, onMute, onOpenFile);
  }

  showReminderList() {
    if (this.plugin.app.workspace.getLeavesOfType(VIEW_TYPE_REMINDER_LIST).length) {
      return;
    }
    this.plugin.app.workspace.getRightLeaf(false).setViewState({
      type: VIEW_TYPE_REMINDER_LIST,
    });
  }

  private detachReminderList() {
    this.plugin.app.workspace.getLeavesOfType(VIEW_TYPE_REMINDER_LIST).forEach((leaf) => leaf.detach());
  }

  async openReminderFile(reminder: Reminder) {
    const leaf = this.plugin.app.workspace.getLeaf(false);

    console.log('Open reminder: ', reminder);
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
    const elapsedSec = (new Date().getTime() - this.lastModified.getTime()) / 1000;
    return elapsedSec < this.editDetectionSec.value;
  }
}
