import { ReadOnlyReference } from "./ref";
import { Reminder } from "./reminder";
import { DateTime, Time } from "./time";

const reminderRegexp =
  /^(?<prefix>\s*)\- \[(?<check>.)\]\s(?<title1>.*?)\(@(?<time>.+?)\)(?<title2>.*)$/;

export class ReminderLine {
  constructor(
    public prefix: string,
    public check: string,
    public title1: string,
    public time: string,
    public title2: string
  ) {}

  toLine(): string {
    return `${this.prefix}- [${this.check}] ${this.title1}(@${this.time})${this.title2}`;
  }
}

export class Content {
  private lines: Array<string>;

  constructor(private file: string, content: string) {
    this.lines = content.split("\n");
  }

  getLine(index: number): string {
    return this.lines[index];
  }

  public getReminders(): Array<Reminder> {
    const reminders: Array<Reminder> = [];
    this.forEachLines((line, lineIndex) => {
      const parsed = this.parseReminderLine(line);
      if (parsed === null) {
        return;
      }
      if (parsed.check === "x") {
        return;
      }

      const title = `${parsed.title1.trim()} ${parsed.title2.trim()}`.trim();
      const parsedTime = DateTime.parse(parsed.time);
      reminders.push(new Reminder(this.file, title, parsedTime, lineIndex));
    });
    return reminders;
  }

  public updateReminder(reminder: Reminder, check: boolean) {
    this.modifyReminderLine(reminder.rowNumber, (line) => {
      line.check = check ? "x" : " ";
      line.time = reminder.time.toString();
    });
  }

  private modifyReminderLine(
    index: number,
    modifyFunc: (r: ReminderLine) => void
  ) {
    const line = this.getLine(index);
    const r = this.parseReminderLine(line);
    if (r === null) {
      throw `not a reminder line: ${line}`;
    }
    modifyFunc(r);
    const newLine = r.toLine();
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

  private parseReminderLine(line: string): ReminderLine | null {
    const result = reminderRegexp.exec(line);
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

  public getContent(): string {
    return this.lines.join("\n");
  }
}
