import { DateTime, Time } from "model/time";

export class Reminder {
  // To avoid duplicate notification, set this flag true before notification and set false on notification done.
  public muteNotification: boolean = false;

  /* Given that `muteNotification` above is playing double duty, we need a flag
   * that lets us serialize reminder display to prevent overload problems on
   * mobile.
   *
   * It should be set to `true` before the reminder is displayed, and then set
   * to false once the reminder is dealt with.
   */
  public beingDisplayed: boolean = false;
  public effectiveTime: DateTime;

  constructor(
    public file: string,
    public title: string,
    public time: DateTime,
    public rowNumber: number,
    public done: boolean,
    public source: "markdown" | "tasknotes" = "markdown",
    public tasknotes?: TaskNotesReminder,
  ) {
    this.effectiveTime = time;
  }

  key() {
    if (this.source === "markdown") {
      return this.file + this.title + this.time.toString();
    }
    if (!this.tasknotes) {
      throw new Error("TaskNotes reminders must include a reminder id.");
    }
    return `${this.file}::tasknotes::${this.tasknotes.reminderId}`;
  }

  /**
   * Checks whether this reminder's time has already passed at `nowMillis`.
   * A date-only reminder falls back to `defaultTime` (the "Reminder Time"
   * setting) for its time part. This is the single expiry predicate shared
   * by the notification flow (`Reminders.getExpiredReminders()`) and the
   * "Overdue" grouping (`groupReminders()`).
   */
  isExpired(nowMillis: number, defaultTime?: Time): boolean {
    return this.effectiveTime.getTimeInMillis(defaultTime) <= nowMillis;
  }

  equals(reminder: Reminder) {
    return (
      this.rowNumber === reminder.rowNumber &&
      this.title === reminder.title &&
      this.time.equals(reminder.time) &&
      this.source === reminder.source &&
      (this.source === "markdown" ||
        (taskNotesEqual(this.tasknotes, reminder.tasknotes) &&
          this.effectiveTime.equals(reminder.effectiveTime))) &&
      this.file === reminder.file
    );
  }

  public getFileName(): string {
    return Reminder.extractFileName(this.file);
  }

  static extractFileName(path: string) {
    const p = path.split(/[/\\]/);
    return p[p.length - 1]!.replace(/^(.*?)(\..+)?$/, "$1");
  }
}

export type TaskNotesAnchorType = "due" | "scheduled" | "absolute";

export interface TaskNotesReminder {
  reminderId: string;
  description?: string;
  anchor: {
    type: TaskNotesAnchorType;
    time: DateTime;
  };
  taskTitle: string;
}

function taskNotesEqual(
  first: TaskNotesReminder | undefined,
  second: TaskNotesReminder | undefined,
): boolean {
  if (!first || !second) {
    return first === second;
  }
  return (
    first.reminderId === second.reminderId &&
    first.description === second.description &&
    first.taskTitle === second.taskTitle &&
    first.anchor.type === second.anchor.type &&
    first.anchor.time.equals(second.anchor.time)
  );
}
