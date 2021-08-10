import moment from "moment";
import { ReadOnlyReference } from "./ref";

export class DateTime {
  public static now(): DateTime {
    return new DateTime(moment(), true);
  }

  public static parse(time: string): DateTime {
    if (time.length > 10) {
      return new DateTime(moment(time, "YYYY-MM-DD HH:mm"), true);
    } else {
      return new DateTime(moment(time, "YYYY-MM-DD"), false);
    }
  }

  public static duration(
    from: DateTime,
    to: DateTime,
    unit: Unit,
    defaultTime?: Time
  ): number {
    return to.fixedTime(defaultTime).diff(from.fixedTime(defaultTime), unit);
  }

  constructor(private time: moment.Moment, private hasTimePart: boolean) {}

  public getTimeInMillis(defaultTime?: Time): number {
    return this.fixedTime(defaultTime).valueOf();
  }

  public format(format: string, defaultTime?: Time) {
    return this.fixedTime(defaultTime).format(format);
  }

  public toYYYYMMMM(defaultTime?: Time): string {
    return this.fixedTime(defaultTime).format("YYYY, MMMM");
  }

  public toYYYYMMDD(defaultTime?: Time): string {
    return this.fixedTime(defaultTime).format("YYYY-MM-DD");
  }

  public add(amount: number, unit: Unit, defaultTime?: Time): DateTime {
    return new DateTime(
      this.fixedTime(defaultTime).clone().add(amount, unit),
      this.hasTimePart
    );
  }

  private fixedTime(defaultTime?: Time): moment.Moment {
    if (this.hasTimePart) {
      return this.time;
    }
    if (defaultTime === undefined) {
      return this.time;
    }
    return this.time.clone().add(defaultTime.minutes, "minutes");
  }

  public toString(): string {
    if (this.hasTimePart) {
      return this.format("YYYY-MM-DD HH:mm");
    } else {
      return this.format("YYYY-MM-DD");
    }
  }
}

export class Time {
  public static parse(text: string): Time {
    const s = text.split(":");
    if (s.length !== 2) {
      throw `unexpected format time: ${text}`;
    }
    const hour = parseInt(s[0]);
    const minute = parseInt(s[1]);
    if (hour > 23 || hour < 0) {
      throw `hour must be 0~23`;
    }
    if (minute > 59 || minute < 0) {
      throw `minute must be 0~59`;
    }
    return new Time(hour, minute);
  }
  private constructor(private hour: number, private minute: number) {}

  get minutes(): number {
    return this.hour * 60 + this.minute;
  }

  public toString(): string {
    const pad = (n: number): string => {
      if (n < 10) {
        return "0" + n;
      }
      return "" + n;
    };
    return `${pad(this.hour)}:${pad(this.minute)}`;
  }
}

export type later = () => DateTime;
type Unit = "seconds" | "minutes" | "hours" | "days";

function add(amount: number, unit: Unit): later {
  return () => {
    return new DateTime(moment(), true).add(amount, unit);
  };
}

export function inMinutes(minutes: number): later {
  return add(minutes, "minutes");
}

export function inHours(hours: number): later {
  return add(hours, "hours");
}

export function nextWeekday(weekday: number): later {
  return () => {
    const today = moment();

    if (today.isoWeekday() <= weekday) {
      return new DateTime(today.isoWeekday(weekday), false);
    } else {
      return new DateTime(today.add(1, "weeks").isoWeekday(weekday), false);
    }
  };
}

export function tomorrow(): later {
  return () => {
    return new DateTime(moment().add(1, "days"), false);
  };
}

export function nextWeek(): later {
  return () => {
    return new DateTime(moment().add(1, "weeks"), false);
  };
}

export class Later {
  constructor(public label: string, public later: later) {}
}

export const Laters: Array<Later> = [
  new Later("In 30 minutes", inMinutes(30)),
  new Later("In 1 hours", inHours(1)),
  new Later("In 3 hours", inHours(3)),
  new Later("Tomorrow", tomorrow()),
  new Later("Next week", nextWeek()),
  new Later("Next Monday", nextWeekday(1)),
  new Later("Next Tuesday", nextWeekday(2)),
  new Later("Next Wednesday", nextWeekday(3)),
  new Later("Next Thursday", nextWeekday(4)),
  new Later("Next Friday", nextWeekday(5)),
  new Later("Next Saturday", nextWeekday(6)),
  new Later("Next Sunday", nextWeekday(7)),
];
