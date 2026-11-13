import { DateTime } from "model/time";

export const DURATION_PATTERN =
  /^([+-])?P(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/;

export function parseDuration(value: string) {
  const match = DURATION_PATTERN.exec(value);
  if (!match) {
    return undefined;
  }
  const [, sign, years, months, weeks, days, hours, minutes, seconds] = match;
  const dateValues = [years, months, weeks, days];
  const timeValues = [hours, minutes, seconds];
  if (
    [...dateValues, ...timeValues].every((part) => part === undefined) ||
    (value.includes("T") && timeValues.every((part) => part === undefined)) ||
    (weeks !== undefined &&
      dateValues.filter((part) => part !== undefined).length > 1)
  ) {
    return undefined;
  }
  if (
    weeks !== undefined &&
    (years !== undefined || months !== undefined || days !== undefined)
  ) {
    return undefined;
  }
  return {
    sign: sign === "-" ? -1 : 1,
    years: Number(years ?? 0),
    months: Number(months ?? 0),
    weeks: Number(weeks ?? 0),
    days: Number(days ?? 0),
    hours: Number(hours ?? 0),
    minutes: Number(minutes ?? 0),
    seconds: Number(seconds ?? 0),
  };
}

export function applyDuration(
  anchor: DateTime,
  duration: NonNullable<ReturnType<typeof parseDuration>>,
) {
  const multiplier = duration.sign;
  let result = anchor.moment().clone();
  result = result.add(multiplier * duration.years, "years");
  result = result.add(multiplier * duration.months, "months");
  result = result.add(multiplier * duration.weeks, "weeks");
  result = result.add(multiplier * duration.days, "days");
  result = result.add(multiplier * duration.hours, "hours");
  result = result.add(multiplier * duration.minutes, "minutes");
  result = result.add(multiplier * duration.seconds, "seconds");
  return DateTime.ofEpochMillis(result.valueOf());
}
