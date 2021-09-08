import { ReminderEdit, MarkdownDocument, modifyReminder, parseReminder } from "model/format";
import { Reminder } from "model/reminder";

export type ReminderTodoEdit = ReminderEdit & {
  checked?: boolean
}

export class Content {
  private doc: MarkdownDocument;

  constructor(file: string, content: string) {
    this.doc = new MarkdownDocument(file, content);
  }

  public getReminders(): Array<Reminder> {
    return parseReminder(this.doc);
  }

  public async modifyReminderLines(modifyFunc: (reminder: Reminder) => ReminderTodoEdit | null) {
    for (const reminder of this.getReminders()) {
      const edit = modifyFunc(reminder);
      if (edit === null) {
        return;
      }
      await this.modifyReminderLine(reminder, edit);
    }
  }

  public async updateReminder(reminder: Reminder, edit: ReminderTodoEdit) {
    await this.modifyReminderLine(reminder, edit);
  }

  private async modifyReminderLine(
    reminder: Reminder,
    edit: ReminderTodoEdit
  ) {
    const modified = await modifyReminder(this.doc, reminder, edit);
    if (modified) {
      console.info("Reminder was updated: reminder=%o", reminder);
    } else {
      console.warn("Cannot modify reminder because it's not a reminder todo: reminder=%o", reminder);
    }
    return modified;
  }

  public getContent(): string {
    return this.doc.toMarkdown();
  }
}
