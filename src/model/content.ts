import { DefaultReminderFormat, ReminderEdit, ReminderFormat } from "./format";
import { Reminder } from "./reminder";

export class Content {
  private lines: Array<string>;
  private format: ReminderFormat = new DefaultReminderFormat();

  constructor(private file: string, content: string) {
    this.lines = content.split("\n");
  }

  getLine(index: number): string {
    return this.lines[index];
  }

  public getReminders(): Array<Reminder> {
    const reminders: Array<Reminder> = [];
    this.forEachLines((line, lineIndex) => {
      const parsed = this.format.parse(this.file, lineIndex, line);
      if (parsed === null) {
        return;
      }
      if (parsed !== null) {
        reminders.push(parsed);
      }
    });
    return reminders;
  }

  public modifyReminderLines(modifyFunc: (reminder: Reminder) => ReminderEdit | null) {
    this.getReminders().forEach(reminder => {
      const edit = modifyFunc(reminder);
      if (edit === null) {
        return;
      }
      this.modifyReminderLine(reminder.rowNumber, edit);
    });
  }

  public updateReminder(reminder: Reminder, edit: ReminderEdit) {
    this.modifyReminderLine(reminder.rowNumber, edit);
  }

  private modifyReminderLine(
    index: number,
    edit: ReminderEdit
  ) {
    const line = this.getLine(index);
    const newLine = this.format.modify(line, edit);
    if (newLine === null) {
      throw `not a reminder line: ${line}`;
    }
    this.lines[index] = newLine;
    console.info(
      "Modify reminder line: file=%s, index=%d, oldLine=%s, newLine=%s",
      this.file,
      index,
      line,
      newLine
    );
  }

  private forEachLines(consumer: (line: string, lineIndex: number) => void) {
    this.lines.forEach(consumer);
  }

  public getContent(): string {
    return this.lines.join("\n");
  }
}
