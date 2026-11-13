import { t } from "i18n";
import { DateTime, Time } from "model/time";
import type { Reminder } from "./reminder";

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
