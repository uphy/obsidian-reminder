import { MarkdownDocument, modifyReminder, parseReminder, ReminderEdit } from "model/format";
import type { Reminder } from "model/reminder";
import type { Todo } from "./format/markdown";

export type ReminderTodoEdit = ReminderEdit & {
  checked?: boolean
}

export class Content {
  private doc: MarkdownDocument;

  constructor(file: string, content: string) {
    this.doc = new MarkdownDocument(file, content);
  }

  public getReminders(doneOnly: boolean = true): Array<Reminder> {
    const reminders = parseReminder(this.doc);
    if (!doneOnly) {
      return reminders;
    }
    return reminders.filter(reminder => !reminder.done);
  }

  public getTodos(): Array<Todo> {
    return this.doc.getTodos();
  }

  public async modifyReminderLines(modifyFunc: (reminder: Reminder) => ReminderTodoEdit | null) {
    for (const reminder of this.getReminders(false)) {
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
