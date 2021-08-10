import { ReadOnlyReference } from "./ref";
import { DateTime, Time } from "./time";

export class Reminder {
  constructor(
    public file: string,
    public title: string,
    public time: DateTime,
    public rowNumber: number
  ) {}
}

export class Reminders {
  public fileToReminders: Map<string, Array<Reminder>> = new Map();
  public reminders: Array<Reminder> = [];
  public reminderTime: ReadOnlyReference<Time>;

  constructor(private onChange: () => void) {}

  public getExpiredReminders(defaultTime: Time): Array<Reminder> {
    const now = new Date().getTime();
    const result: Array<Reminder> = [];
    for (let i = 0; i < this.reminders.length; i++) {
      const reminder = this.reminders[i];
      if (reminder.time.getTimeInMillis(defaultTime) <= now) {
        result.push(reminder);
      } else {
        break;
      }
    }
    return result;
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

  public removeFile(filePath: string) {
    if (this.fileToReminders.delete(filePath)) {
      this.sortReminders();
    }
  }

  public replaceFile(filePath: string, reminders: Array<Reminder>) {
    this.fileToReminders.set(filePath, reminders);
    this.sortReminders();
  }

  private sortReminders() {
    const reminders: Array<Reminder> = [];

    for (const r of this.fileToReminders.values()) {
      reminders.push(...r);
    }

    reminders.sort((a, b) => {
      const d =
        a.time.getTimeInMillis(this.reminderTime.value) -
        b.time.getTimeInMillis(this.reminderTime.value);
      return d > 0 ? 1 : d < 0 ? -1 : 0;
    });
    this.reminders = reminders;
    this.onChange();
  }
}

function generateGroup(time: DateTime, now: DateTime, reminderTime: Time) {
  const days = DateTime.duration(now, time, "days", reminderTime);
  if (days > 30) {
    return new Group(time.toYYYYMMMM(reminderTime), (time) =>
      time.format("MM/DD", reminderTime)
    );
  }
  if (days >= 7) {
    return new Group("Over 1 week", (time) =>
      time.format("MM/DD", reminderTime)
    );
  }
  if (time.toYYYYMMDD(reminderTime) === now.toYYYYMMDD(reminderTime)) {
    const todaysGroup = new Group("Today", (time) =>
      time.format("HH:mm", reminderTime)
    );
    todaysGroup.isToday = true;
    return todaysGroup;
  }
  if (
    time.toYYYYMMDD(reminderTime) ===
    now.add(1, "days", reminderTime).toYYYYMMDD()
  ) {
    return new Group("Tomorrow", (time) => time.format("HH:mm", reminderTime));
  }
  return new Group(time.format("M/DD (ddd)", reminderTime), (time) =>
    time.format("HH:mm", reminderTime)
  );
}

class Group {
  public isToday: boolean = false;
  constructor(
    public name: string,
    private timeToStringFunc: (time: DateTime) => string
  ) {}

  timeToString(time: DateTime): string {
    return this.timeToStringFunc(time);
  }
}

export function groupReminders(
  sortedReminders: Array<Reminder>,
  reminderTime: Time
): Array<GroupedReminder> {
  const now = DateTime.now();
  const result: Array<GroupedReminder> = [];
  let currentReminders: Array<Reminder> = [];
  // Always shows today's group
  let previousGroup: Group = generateGroup(now, now, reminderTime);
  for (let i = 0; i < sortedReminders.length; i++) {
    const r = sortedReminders[i];
    const group = generateGroup(r.time, now, reminderTime);
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
  return result;
}

export class GroupedReminder {
  constructor(private group: Group, public reminders: Array<Reminder>) {}

  get name() {
    return this.group.name;
  }

  timeToString(time: DateTime): string {
    return this.group.timeToString(time);
  }
}
