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
    const reminders: Array<Reminder> = [];
    this.doc.getTodos().forEach(todo => {
      if (todo.isChecked()) {
        return;
      }
      const parsed = parseReminder(this.doc.file, todo.lineIndex, todo.body);
      if (parsed === null) {
        return;
      }
      if (parsed !== null) {
        reminders.push(parsed);
      }
    });
    return reminders;
  }

  public modifyReminderLines(modifyFunc: (reminder: Reminder) => ReminderTodoEdit | null) {
    this.getReminders().forEach(reminder => {
      const edit = modifyFunc(reminder);
      if (edit === null) {
        return;
      }
      this.modifyReminderLine(reminder.rowNumber, edit);
    });
  }

  public updateReminder(reminder: Reminder, edit: ReminderTodoEdit) {
    this.modifyReminderLine(reminder.rowNumber, edit);
  }

  private modifyReminderLine(
    lineNumber: number,
    edit: ReminderTodoEdit
  ) {
    const todo = this.doc.getTodo(lineNumber);
    const newBody = modifyReminder(todo.body, edit);
    if (newBody === null) {
      throw `not a reminder line: ${todo.toMarkdown()}`;
    }
    if (edit.checked !== undefined) {
      todo.setChecked(edit.checked);
    }

    console.info(
      "Modify reminder: file=%s, index=%d, oldBody=%s, newBody=%s",
      this.doc.file,
      lineNumber,
      todo.body,
      newBody
    );
    todo.body = newBody;
  }

  public getContent(): string {
    return this.doc.toMarkdown();
  }
}
