import type { ReadOnlyReference } from "model/ref";
import { DateTime, Time } from "model/time";

export class Reminder {
  // To avoid duplicate notification, set this flag true before notification and set false on notification done.
  public muteNotification: boolean = false;

  /* Given that `muteNotification` above is playing double duty, we need a flag
   * that lets us serialize reminder display to prevent overload problems on
   * mobile.
   */
  public beingDisplayed: boolean = false;

  //Speichert den Zeitstempel der letzten Benachrichtigung für Wiederholungen
  public lastNotifiedTime?: number;

  constructor(
    public file: string,
    public title: string,
    public time: DateTime,
    public rowNumber: number,
    public done: boolean,
  ) {}

  key() {
    return this.file + this.title + this.time.toString();
  }

  equals(reminder: Reminder) {
    return (
      this.rowNumber === reminder.rowNumber &&
      this.title === reminder.title &&
      this.time.equals(reminder.time) &&
      this.file === reminder.file
    );
  }

  public getFileName(): string {
    const p = this.file.split(/[/\\]/);
    return p[p.length - 1]!.replace(/^(.*?)(\..+)?$/, "$1");
  }

  static extractFileName(path: string) {
    const p = path.split(/[/\\]/);
    return p[p.length - 1]!.replace(/^(.*?)(\..+)?$/, "$1");
  }
}

export class Reminders {
  public fileToReminders: Map<string, Array<Reminder>> = new Map();
  public reminders: Array<Reminder> = [];
  public reminderTime?: ReadOnlyReference<Time>;

  constructor(private onChange: () => void) {}

  /**
   * Gibt alle fälligen Reminder zurück.
   * @param defaultTime Standardzeit für Reminder ohne Zeitangabe.
   * @param repeatConfig Optional: Konfiguration für wiederholte Benachrichtigungen überfälliger Aufgaben.
   */
  public getExpiredReminders(
    defaultTime: Time,
    repeatConfig?: { repeat: boolean; intervalMin: number },
  ): Array<Reminder> {
    const now = new Date().getTime();
    const result: Array<Reminder> = [];

    for (let i = 0; i < this.reminders.length; i++) {
      const reminder = this.reminders[i]!;
      const reminderTimeMillis = reminder.time.getTimeInMillis(defaultTime);

      if (reminderTimeMillis <= now) {
        // Fall 1: Wurde noch nicht benachrichtigt
        if (!reminder.muteNotification) {
          result.push(reminder);
        }
        // Fall 2: Wurde bereits benachrichtigt, aber soll wiederholt werden
        else if (repeatConfig?.repeat && reminder.lastNotifiedTime) {
          const intervalMs = repeatConfig.intervalMin * 60 * 1000;
          if (now - reminder.lastNotifiedTime >= intervalMs) {
            result.push(reminder);
          }
        }
      } else {
        // Da die Liste sortiert ist, können wir abbrechen, sobald eine Zeit in der Zukunft liegt
        break;
      }
    }
    return result;
  }

  public byDate(date: DateTime) {
    return this.reminders.filter(
      (reminder) => reminder.time.toYYYYMMDD() === date.toYYYYMMDD(),
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

  public removeByFile(filePath: string) {
    if (this.fileToReminders.delete(filePath)) {
      this.sortReminders();
      return true;
    }
    return false;
  }

  public replaceFile(filePath: string, reminders: Array<Reminder>): boolean {
    const oldReminders = this.fileToReminders.get(filePath);
    if (oldReminders) {
      if (this.equals(oldReminders, reminders)) {
        return false;
      }

      // Zustand (Mute & Zeitstempel) von alten Remindern auf neue übertragen
      const reminderState = new Map<
        string,
        { mute: boolean; lastNotified?: number }
      >();
      for (const reminder of oldReminders) {
        reminderState.set(reminder.key(), {
          mute: reminder.muteNotification,
          lastNotified: reminder.lastNotifiedTime,
        });
      }

      for (const reminder of reminders) {
        const state = reminderState.get(reminder.key());
        if (state !== undefined) {
          reminder.muteNotification = state.mute;
          reminder.lastNotifiedTime = state.lastNotified;
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
    this.sort(r1);
    this.sort(r2);
    for (const i in r1) {
      const reminder1 = r1[i];
      const reminder2 = r2[i];
      if (reminder1 == null && reminder2 != null) return false;
      if (reminder2 == null && reminder1 != null) return false;
      if (reminder1 == null && reminder2 == null) continue;
      if (!reminder1!.equals(reminder2!)) return false;
    }
    return true;
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
        a.time.getTimeInMillis(this.reminderTime?.value) -
        b.time.getTimeInMillis(this.reminderTime?.value);
      return d > 0 ? 1 : d < 0 ? -1 : 0;
    });
  }
}

// ... (Rest der Datei: DateDisplayFormat, groupReminders etc. bleibt gleich)

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
      time.format(format.yearMonthFormat, reminderTime),
      (time) => time.format(format.monthDayFormat, reminderTime),
    );
  }
  if (days >= 7) {
    return new Group("Over 1 week", (time) =>
      time.format(format.monthDayFormat, reminderTime),
    );
  }
  if (time.toYYYYMMDD(reminderTime) === now.toYYYYMMDD(reminderTime)) {
    const todaysGroup = new Group("Today", (time) =>
      time.format(format.timeFormat, reminderTime),
    );
    todaysGroup.isToday = true;
    return todaysGroup;
  }
  if (
    time.toYYYYMMDD(reminderTime) ===
    now.add(1, "days", reminderTime).toYYYYMMDD()
  ) {
    return new Group("Tomorrow", (time) =>
      time.format(format.timeFormat, reminderTime),
    );
  }
  return new Group(
    time.format(format.shortDateWithWeekdayFormat, reminderTime),
    (time) => time.format(format.timeFormat, reminderTime),
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
  const result: Array<GroupedReminder> = [];
  let currentReminders: Array<Reminder> = [];
  const overdueReminders: Array<Reminder> = [];
  // Always shows today's group
  let previousGroup: Group = generateGroup(now, now, reminderTime, format);
  for (let i = 0; i < sortedReminders.length; i++) {
    const r = sortedReminders[i]!;
    if (r.muteNotification) {
      overdueReminders.push(r);
      continue;
    }
    const group = generateGroup(r.time, now, reminderTime, format);
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
    const overdueGroup: Group = new Group("Overdue", (time) =>
      time.format(format.timeFormat, reminderTime),
    );
    overdueGroup.isOverdue = true;
    result.splice(0, 0, new GroupedReminder(overdueGroup, overdueReminders));
    console.log(overdueGroup);
    console.log(result);
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
