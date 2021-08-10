import { ItemView, WorkspaceLeaf } from "obsidian";
import { ReadOnlyReference } from "src/model/ref";
import { Time } from "src/model/time";
import { VIEW_TYPE_REMINDER_LIST } from "../constants";
import { groupReminders, Reminder, Reminders } from "../model/reminder";
import ReminderListView from "./components/ReminderList.svelte";
export class ReminderListItemView extends ItemView {
  private view: ReminderListView;
  // valid is a flag which means that this view should be re-rendered if true;
  private valid: boolean = false;

  constructor(
    leaf: WorkspaceLeaf,
    private reminders: Reminders,
    private reminderTime: ReadOnlyReference<Time>,
    private onOpenReminder: (reminder: Reminder) => void
  ) {
    super(leaf);
  }

  getViewType(): string {
    return VIEW_TYPE_REMINDER_LIST;
  }

  getDisplayText(): string {
    return "Reminders";
  }

  async onOpen(): Promise<void> {
    this.view = new ReminderListView({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      target: (this as any).contentEl,
      props: {
        groups: this.remindersForView(),
        onOpenReminder: this.onOpenReminder,
      },
    });
  }

  reload(force: boolean = false) {
    if (force || !this.valid) {
      if (this.view) {
        this.view.$set({
          groups: this.remindersForView(),
          onOpenReminder: this.onOpenReminder,
        });
        this.valid = true;
      } else {
        console.debug("view is null.  Skipping reminder list view reload");
      }
    }
  }

  private remindersForView() {
    return groupReminders(this.reminders.reminders, this.reminderTime.value);
  }

  invalidate() {
    this.valid = false;
  }

  onClose(): Promise<void> {
    if (this.view) {
      this.view.$destroy();
    }
    return Promise.resolve();
  }
}
