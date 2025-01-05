import type { ReadOnlyReference } from 'model/ref';
import type { Time } from 'model/time';
import { ItemView, TFile, View, Workspace, WorkspaceLeaf } from 'obsidian';
import ReminderListView from 'ui/ReminderList.svelte';
import { Reminder, Reminders, groupReminders } from '../../model/reminder';
import { VIEW_TYPE_REMINDER_LIST } from './constants';

class ReminderListItemView extends ItemView {
  private view?: ReminderListView;

  constructor(
    leaf: WorkspaceLeaf,
    private reminders: Reminders,
    private reminderTime: ReadOnlyReference<Time>,
    private onOpenReminder: (reminder: Reminder) => void,
  ) {
    super(leaf);
  }

  getViewType(): string {
    return VIEW_TYPE_REMINDER_LIST;
  }

  getDisplayText(): string {
    return 'Reminders';
  }

  override getIcon(): string {
    return 'clock';
  }

  override async onOpen(): Promise<void> {
    this.view = new ReminderListView({
      target: (this as any).contentEl,
      props: {
        groups: this.remindersForView(),
        onOpenReminder: this.onOpenReminder,
        component: this,
        generateLink: (reminder: Reminder): string => {
          const aFile = this.app.vault.getAbstractFileByPath(reminder.file);
          const destinationFile = this.app.workspace.getActiveFile();
          let linkMd: string;
          if (!(aFile instanceof TFile) || destinationFile == null) {
            linkMd = `[[${reminder.getFileName()}]]`;
          } else {
            linkMd = this.app.fileManager.generateMarkdownLink(aFile, destinationFile.path);
          }
          return `${reminder.title} - ${linkMd}`;
        },
      },
    });
  }

  reload() {
    if (this.view == null) {
      return;
    }
    this.view.$set({
      groups: this.remindersForView(),
      onOpenReminder: this.onOpenReminder,
    });
  }

  private remindersForView() {
    return groupReminders(this.reminders.reminders, this.reminderTime.value);
  }

  override onClose(): Promise<void> {
    if (this.view) {
      this.view.$destroy();
    }
    return Promise.resolve();
  }
}

export class ReminderListItemViewProxy {
  // valid is a flag which means that this view should be re-rendered if true;
  private valid: boolean = false;

  constructor(
    private workspace: Workspace,
    private reminders: Reminders,
    private reminderTime: ReadOnlyReference<Time>,
    private onOpenReminder: (reminder: Reminder) => void,
  ) {}

  createView(leaf: WorkspaceLeaf): View {
    return new ReminderListItemView(leaf, this.reminders, this.reminderTime, this.onOpenReminder);
  }

  openView(): void {
    if (this.workspace.getLeavesOfType(VIEW_TYPE_REMINDER_LIST).length) {
      // reminder list view is already in workspace
      return;
    }
    // Create new view
    this.workspace.getRightLeaf(false)?.setViewState({
      type: VIEW_TYPE_REMINDER_LIST,
    });
  }

  reload(force: boolean = false) {
    if (force || !this.valid) {
      const views = this.getViews();
      if (views.length > 0) {
        views.forEach((view) => view?.reload());
        this.valid = true;
      } else {
        this.valid = false;
        console.debug('view is null.  Skipping reminder list view reload');
      }
    }
  }

  private getViews() {
    return this.workspace
      .getLeavesOfType(VIEW_TYPE_REMINDER_LIST)
      .map((leaf) => {
        if (leaf && leaf.view instanceof ReminderListItemView) {
          return leaf.view as ReminderListItemView;
        }
        return null;
      })
      .filter((view) => view != null);
  }

  invalidate() {
    this.valid = false;
  }
}
