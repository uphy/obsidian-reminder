import { Reminder } from "./reminder";
import { DateTime, DATE_TIME_FORMATTER, Time } from "./time";

export class ReminderLine {
  constructor(
    public prefix: string,
    public check: string,
    public title1: string,
    public time: string,
    public title2: string
  ) { }

  toLine(): string {
    return `${this.prefix}- [${this.check}] ${this.title1}(@${this.time})${this.title2}`;
  }
}

export class ReminderEdit {
  public checked: boolean | null = null;
  public time: DateTime | null = null;
  public rawTime: string | null = null;
}

interface ReminderFormat {
  parse(file: string, lineIndex: number, line: string): Reminder | null
  modify(line: string, edit: ReminderEdit): string;
}

class DefaultReminderFormat implements ReminderFormat {

  private static reminderRegexp = /^(?<prefix>\s*)\- \[(?<check>.)\]\s(?<title1>.*?)\(@(?<time>.+?)\)(?<title2>.*)$/;

  parse(file: string, lineIndex: number, line: string): Reminder | null {
    const parsed = this.parseReminderLine(line);
    if (parsed === null) {
      return null;
    }
    if (parsed.check === "x") {
      return null;
    }

    const title = `${parsed.title1.trim()} ${parsed.title2.trim()}`.trim();
    const parsedTime = DATE_TIME_FORMATTER.parse(parsed.time);
    if (parsedTime !== null) {
      return new Reminder(file, title, parsedTime, lineIndex);
    }
    return null;
  }

  modify(line: string, edit: ReminderEdit): string {
    const r = this.parseReminderLine(line);
    if (r === null) {
      throw `not a reminder line: ${line}`;
    }
    if (edit.checked !== null) {
      r.check = edit.checked ? "x" : " ";
    }
    if (edit.rawTime !== null) {
      r.time = edit.rawTime;
    } else if (edit.time !== null) {
      r.time = DATE_TIME_FORMATTER.toString(edit.time);
    }
    return r.toLine();
  }

  private parseReminderLine(line: string): ReminderLine | null {
    const result = DefaultReminderFormat.reminderRegexp.exec(line);
    if (result === null) {
      return null;
    }
    const prefix = result.groups.prefix;
    const check = result.groups.check;
    const title1 = result.groups.title1;
    const time = result.groups.time;
    const title2 = result.groups.title2;
    return new ReminderLine(prefix, check, title1, time, title2);
  }

}

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

  public updateReminder(reminder: Reminder, check: boolean) {
    const edit = new ReminderEdit();
    edit.checked = check;
    edit.time = reminder.time;
    this.modifyReminderLine(reminder.rowNumber, edit);
  }

  private modifyReminderLine(
    index: number,
    edit: ReminderEdit
  ) {
    const line = this.getLine(index);
    const newLine = this.format.modify(line, edit);
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
