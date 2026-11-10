import { t } from "i18n";
import type { ReadOnlyReference } from "model/ref";
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

export class Reminders {
  public fileToReminders: Map<string, Array<Reminder>> = new Map();
  public reminders: Array<Reminder> = [];
  public reminderTime?: ReadOnlyReference<Time>;

  constructor(private onChange: () => void) {}

  public getExpiredReminders(defaultTime: Time): Array<Reminder> {
    const now = new Date().getTime();
    const result: Array<Reminder> = [];
    for (let i = 0; i < this.reminders.length; i++) {
      const reminder = this.reminders[i]!;
      if (reminder.isExpired(now, defaultTime)) {
        result.push(reminder);
      } else {
        break;
      }
    }
    return result;
  }

  /**
   * Mutes every currently expired reminder (bulk mute, #220), so the
   * notification storm after a long absence can be stopped in one action.
   * Mirrors the single-reminder mute path: it only flips `muteNotification`
   * and does not call `onChange()`, leaving UI reload to the caller.
   *
   * @returns the number of reminders that were newly muted (already-muted
   * expired reminders don't count).
   */
  public muteExpiredReminders(defaultTime: Time): number {
    let count = 0;
    for (const reminder of this.getExpiredReminders(defaultTime)) {
      if (!reminder.muteNotification) {
        reminder.muteNotification = true;
        count++;
      }
    }
    return count;
  }

  public byDate(date: DateTime) {
    return this.reminders.filter(
      (reminder) => reminder.effectiveTime.toYYYYMMDD() === date.toYYYYMMDD(),
    );
  }

  public removeReminder(reminder: Reminder) {
    console.debug("Remove reminder: %o", reminder);
    this.reminders.remove(reminder);
    const file = this.fileToReminders.get(reminder.file);
    if (file) {
      file.remove(reminder);
      if (file.length === 0) {
        this.fileToReminders.delete(reminder.file);
      }
    }
    this.onChange();
  }

  public clear() {
    this.fileToReminders.clear();
    this.reminders = [];
    this.onChange();
  }

  public clearSource(source: Reminder["source"]): boolean {
    let changed = false;
    for (const [filePath, reminders] of this.fileToReminders.entries()) {
      const retained = reminders.filter(
        (reminder) => reminder.source !== source,
      );
      if (retained.length !== reminders.length) {
        changed = true;
        if (retained.length === 0) {
          this.fileToReminders.delete(filePath);
        } else {
          this.fileToReminders.set(filePath, retained);
        }
      }
    }
    if (changed) {
      this.sortReminders();
    }
    return changed;
  }

  public removeByFile(filePath: string) {
    if (this.fileToReminders.delete(filePath)) {
      this.sortReminders();
      return true;
    }
    return false;
  }

  public removeSourceFile(
    filePath: string,
    source: Reminder["source"],
  ): boolean {
    const current = this.fileToReminders.get(filePath);
    if (!current) {
      return false;
    }
    const retained = current.filter((reminder) => reminder.source !== source);
    if (retained.length === current.length) {
      return false;
    }
    if (retained.length === 0) {
      this.fileToReminders.delete(filePath);
    } else {
      this.fileToReminders.set(filePath, retained);
    }
    this.sortReminders();
    return true;
  }

  public hasSourceFile(filePath: string, source: Reminder["source"]): boolean {
    return (
      this.fileToReminders
        .get(filePath)
        ?.some((reminder) => reminder.source === source) ?? false
    );
  }

  public replaceSourceFile(
    filePath: string,
    source: Reminder["source"],
    reminders: Array<Reminder>,
  ): boolean {
    if (!this.replaceSourceFileInMap(filePath, source, reminders)) {
      return false;
    }
    this.sortReminders();
    return true;
  }

  /**
   * Replaces the complete set of files for a reminder source in one update.
   * Paths omitted from `files` have their reminders for `source` removed.
   */
  public replaceSourceFiles(
    source: Reminder["source"],
    files: Map<string, Array<Reminder>>,
  ): boolean {
    const filePaths = new Set([
      ...this.fileToReminders.keys(),
      ...files.keys(),
    ]);
    let changed = false;
    filePaths.forEach((filePath) => {
      if (
        this.replaceSourceFileInMap(filePath, source, files.get(filePath) ?? [])
      ) {
        changed = true;
      }
    });
    if (changed) {
      this.sortReminders();
    }
    return changed;
  }

  private replaceSourceFileInMap(
    filePath: string,
    source: Reminder["source"],
    reminders: Array<Reminder>,
  ): boolean {
    const current = this.fileToReminders.get(filePath) ?? [];
    const oldByKey = new Map(
      current
        .filter((reminder) => reminder.source === source)
        .map((reminder) => [reminder.key(), reminder]),
    );
    for (const reminder of reminders) {
      const old = oldByKey.get(reminder.key());
      if (old?.time.equals(reminder.time)) {
        reminder.muteNotification = old.muteNotification;
      }
    }
    const retained = current.filter((reminder) => reminder.source !== source);
    const replacement = [...retained, ...reminders];
    if (this.equals(current, replacement)) {
      return false;
    }
    if (replacement.length === 0) {
      this.fileToReminders.delete(filePath);
    } else {
      this.fileToReminders.set(filePath, replacement);
    }
    return true;
  }

  public migrateSourceFile(
    oldPath: string,
    newPath: string,
    source: Reminder["source"],
  ): boolean {
    const oldFile = this.fileToReminders.get(oldPath);
    if (!oldFile) {
      return false;
    }
    const moved = oldFile.filter((reminder) => reminder.source === source);
    if (moved.length === 0) {
      return false;
    }
    const retained = oldFile.filter((reminder) => reminder.source !== source);
    if (retained.length === 0) {
      this.fileToReminders.delete(oldPath);
    } else {
      this.fileToReminders.set(oldPath, retained);
    }
    moved.forEach((reminder) => {
      reminder.file = newPath;
    });
    const destination = this.fileToReminders.get(newPath) ?? [];
    const destinationRetained = destination.filter(
      (reminder) => reminder.source !== source,
    );
    this.fileToReminders.set(newPath, [...destinationRetained, ...moved]);
    this.sortReminders();
    return true;
  }

  public resort(): void {
    this.sortReminders();
  }

  public replaceFile(filePath: string, reminders: Array<Reminder>): boolean {
    // migrate muteNotification property
    const oldReminders = this.fileToReminders.get(filePath);
    if (oldReminders) {
      if (this.equals(oldReminders, reminders)) {
        return false;
      }
      const keyToMuteNotification = new Map<string, boolean>();
      for (const reminder of oldReminders) {
        keyToMuteNotification.set(reminder.key(), reminder.muteNotification);
      }
      for (const reminder of reminders) {
        const mute = keyToMuteNotification.get(reminder.key());
        keyToMuteNotification.set(reminder.key(), reminder.muteNotification);
        if (mute !== undefined) {
          reminder.muteNotification = mute;
        }
      }
    }
    // update
    this.fileToReminders.set(filePath, reminders);
    this.sortReminders();
    return true;
  }

  private equals(r1: Array<Reminder>, r2: Array<Reminder>) {
    if (r1.length !== r2.length) {
      return false;
    }
    // Sort copies so we don't mutate the arrays passed in (r1 may be the
    // array stored inside fileToReminders, and an equality check must not
    // change stored state).
    const sorted1 = [...r1];
    const sorted2 = [...r2];
    this.sort(sorted1);
    this.sort(sorted2);
    return sorted1.every((a, i) => a.equals(sorted2[i]!));
  }

  private sortReminders() {
    const reminders: Array<Reminder> = [];

    for (const r of this.fileToReminders.values()) {
      reminders.push(...r);
    }

    this.sort(reminders);
    this.reminders = reminders;
    this.onChange();
  }

  private sort(reminders: Array<Reminder>) {
    reminders.sort((a, b) => {
      const d =
        a.effectiveTime.getTimeInMillis(this.reminderTime?.value) -
        b.effectiveTime.getTimeInMillis(this.reminderTime?.value);
      return d > 0 ? 1 : d < 0 ? -1 : 0;
    });
  }
}

export type DateDisplayFormat = {
  yearMonthFormat: string;
  monthDayFormat: string;
  shortDateWithWeekdayFormat: string;
  timeFormat: string;
};

export type DateDisplayFormatPreset = {
  name: string;
  format: DateDisplayFormat;
};

export const dateDisplayFormatPresets: DateDisplayFormatPreset[] = [
  {
    name: "US Style (12h)",
    format: {
      yearMonthFormat: "MMMM YYYY",
      monthDayFormat: "MM/DD",
      shortDateWithWeekdayFormat: "M/DD (ddd)",
      timeFormat: "h:mm A",
    },
  },
  {
    name: "US Style (24h)",
    format: {
      yearMonthFormat: "MMMM YYYY",
      monthDayFormat: "MM/DD",
      shortDateWithWeekdayFormat: "M/DD (ddd)",
      timeFormat: "HH:mm",
    },
  },
  {
    name: "EU Style (24h)",
    format: {
      yearMonthFormat: "MMMM YYYY",
      monthDayFormat: "DD/MM",
      shortDateWithWeekdayFormat: "D/MM (ddd)",
      timeFormat: "HH:mm",
    },
  },
  {
    name: "EU Style (12h)",
    format: {
      yearMonthFormat: "MMMM YYYY",
      monthDayFormat: "DD/MM",
      shortDateWithWeekdayFormat: "D/MM (ddd)",
      timeFormat: "h:mm A",
    },
  },
  {
    name: "JP Style (24h)",
    format: {
      yearMonthFormat: "YYYY年MM月",
      monthDayFormat: "MM/DD",
      shortDateWithWeekdayFormat: "M月D日 (ddd)",
      timeFormat: "HH:mm",
    },
  },
  {
    name: "JP Style (12h)",
    format: {
      yearMonthFormat: "YYYY年MM月",
      monthDayFormat: "MM/DD",
      shortDateWithWeekdayFormat: "M月D日 (ddd)",
      timeFormat: "h:mm A",
    },
  },
];

function generateGroup(
  time: DateTime,
  now: DateTime,
  reminderTime: Time,
  format: DateDisplayFormat,
) {
  const days = DateTime.duration(now, time, "days", reminderTime);
  if (days > 30) {
    return new Group(
      time.formatForDisplay(format.yearMonthFormat, reminderTime),
      (time) => time.formatForDisplay(format.monthDayFormat, reminderTime),
    );
  }
  if (days >= 7) {
    return new Group(t("Over 1 week"), (time) =>
      time.formatForDisplay(format.monthDayFormat, reminderTime),
    );
  }
  if (time.toYYYYMMDD(reminderTime) === now.toYYYYMMDD(reminderTime)) {
    const todaysGroup = new Group(t("Today"), (time) =>
      time.formatForDisplay(format.timeFormat, reminderTime),
    );
    todaysGroup.isToday = true;
    return todaysGroup;
  }
  if (
    time.toYYYYMMDD(reminderTime) ===
    now.add(1, "days", reminderTime).toYYYYMMDD()
  ) {
    return new Group(t("Tomorrow"), (time) =>
      time.formatForDisplay(format.timeFormat, reminderTime),
    );
  }
  return new Group(
    time.formatForDisplay(format.shortDateWithWeekdayFormat, reminderTime),
    (time) => time.formatForDisplay(format.timeFormat, reminderTime),
  );
}

class Group {
  public isToday: boolean = false;
  public isOverdue: boolean = false;
  constructor(
    public name: string,
    private timeToStringFunc: (time: DateTime) => string,
  ) {}

  timeToString(time: DateTime): string {
    return this.timeToStringFunc(time);
  }
}

export function groupReminders(
  sortedReminders: Array<Reminder>,
  reminderTime: Time,
  format: DateDisplayFormat,
): Array<GroupedReminder> {
  const now = DateTime.now();
  const nowMillis = now.getTimeInMillis();
  const result: Array<GroupedReminder> = [];
  let currentReminders: Array<Reminder> = [];
  const overdueReminders: Array<Reminder> = [];
  // Always shows today's group
  let previousGroup: Group = generateGroup(now, now, reminderTime, format);
  for (let i = 0; i < sortedReminders.length; i++) {
    const r = sortedReminders[i]!;
    // The Overdue group must reflect actual time, not just mute state:
    // `muteNotification` is only set by the notification flow, so with
    // notifications disabled (or at startup, before the first notification
    // fires) it never gets set. Use the same expiry predicate as
    // `Reminders.getExpiredReminders()`.
    if (r.muteNotification || r.isExpired(nowMillis, reminderTime)) {
      overdueReminders.push(r);
      continue;
    }
    const group = generateGroup(r.effectiveTime, now, reminderTime, format);
    if (group.name !== previousGroup.name) {
      if (currentReminders.length > 0 || previousGroup.isToday) {
        result.push(new GroupedReminder(previousGroup, currentReminders));
      }
      currentReminders = [];
    }
    currentReminders.push(r);
    previousGroup = group;
  }
  if (currentReminders.length > 0) {
    result.push(new GroupedReminder(previousGroup, currentReminders));
  }
  if (overdueReminders.length > 0) {
    const overdueGroup: Group = new Group(t("Overdue"), (time) => {
      // Overdue reminders can be from a previous day, so a time-only label
      // like "09:00" would be ambiguous about which day it refers to.
      // Show the date only (no time) for previous days: once a reminder is
      // days overdue the exact time matters little, and with the default
      // formats the date label has the same width as the time label, keeping
      // the titles within the group aligned.
      if (time.toYYYYMMDD(reminderTime) === now.toYYYYMMDD(reminderTime)) {
        return time.formatForDisplay(format.timeFormat, reminderTime);
      }
      return time.formatForDisplay(format.monthDayFormat, reminderTime);
    });
    overdueGroup.isOverdue = true;
    result.splice(0, 0, new GroupedReminder(overdueGroup, overdueReminders));
  }
  return result;
}

export class GroupedReminder {
  constructor(
    private group: Group,
    public reminders: Array<Reminder>,
  ) {}

  get name() {
    return this.group.name;
  }

  get isOverdue() {
    return this.group.isOverdue;
  }

  timeToString(time: DateTime): string {
    return this.group.timeToString(time);
  }
}
