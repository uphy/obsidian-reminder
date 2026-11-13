import { moment } from "model/moment";
import { DateTime, Time } from "model/time";
import { coerceScalar } from "./values";

export const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
export const DATETIME_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})?$/i;

export function parseAnchor(value: unknown, dateOnlyAnchorTime: string) {
  const scalar = coerceAnchorScalar(value);
  if (!scalar) {
    return undefined;
  }
  if (DATE_PATTERN.test(scalar)) {
    const date = moment(scalar, "YYYY-MM-DD", true);
    const time = parseAnchorTime(dateOnlyAnchorTime);
    if (!date.isValid() || !time) {
      return undefined;
    }
    return DateTime.ofEpochMillis(
      date
        .hour(Math.floor(time.minutes / 60))
        .minute(time.minutes % 60)
        .valueOf(),
    );
  }
  if (!DATETIME_PATTERN.test(scalar)) {
    return undefined;
  }
  const datetime = moment(scalar, moment.ISO_8601, true);
  return datetime.isValid()
    ? DateTime.ofEpochMillis(datetime.valueOf())
    : undefined;
}

function coerceAnchorScalar(value: unknown): string | undefined {
  if (
    value instanceof Date &&
    Number.isFinite(value.getTime()) &&
    value.getUTCHours() === 0 &&
    value.getUTCMinutes() === 0 &&
    value.getUTCSeconds() === 0 &&
    value.getUTCMilliseconds() === 0
  ) {
    return value.toISOString().slice(0, 10);
  }
  return coerceScalar(value);
}

export function parseDateTime(value: unknown) {
  const scalar = coerceScalar(value);
  if (!scalar || !DATETIME_PATTERN.test(scalar)) {
    return undefined;
  }
  const datetime = moment(scalar, moment.ISO_8601, true);
  return datetime.isValid()
    ? DateTime.ofEpochMillis(datetime.valueOf())
    : undefined;
}

function parseAnchorTime(value: string) {
  if (!/^\d{2}:\d{2}$/.test(value)) {
    return undefined;
  }
  const [hours, minutes] = value.split(":").map(Number);
  if (
    hours === undefined ||
    minutes === undefined ||
    hours > 23 ||
    minutes > 59
  ) {
    return undefined;
  }
  return Time.parse(value);
}
