import { Reminder } from "model/reminder";
import type { TaskNotesAnchorType } from "model/reminder";
import { moment } from "model/moment";
import { DateTime, Time } from "model/time";

export type TaskNotesIdentificationMode = "tag" | "property" | "reminders";

export interface TaskNotesPropertyNames {
  title: string;
  status: string;
  due: string;
  scheduled: string;
  reminders: string;
  completedDate: string;
  recurrence: string;
  completeInstances: string;
  skippedInstances: string;
}

export interface TaskNotesOptions {
  identificationMode: TaskNotesIdentificationMode;
  tag: string;
  identificationProperty: string;
  identificationValue: string;
  excludedFolders: Array<string>;
  properties: TaskNotesPropertyNames;
  completedStatuses: Array<string>;
  skipCompleted: boolean;
  skipArchived: boolean;
  archiveTag: string;
  skipRecurringInstances: boolean;
  dateOnlyAnchorTime: string;
  ignoreOlderThanDays: number;
}

export interface TaskNotesContext {
  filePath: string;
  fileName: string;
  tags: Array<string>;
  options: TaskNotesOptions;
  now?: DateTime;
  effectiveTimeFor?: (reminderId: string, trigger: DateTime) => DateTime;
  warnOnce?: (key: string, message: string) => void;
}

export const DEFAULT_TASKNOTES_PROPERTIES: TaskNotesPropertyNames = {
  title: "title",
  status: "status",
  due: "due",
  scheduled: "scheduled",
  reminders: "reminders",
  completedDate: "completedDate",
  recurrence: "recurrence",
  completeInstances: "complete_instances",
  skippedInstances: "skipped_instances",
};

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DATETIME_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})?$/i;
const DURATION_PATTERN =
  /^([+-])?P(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/;
const warnedInvalidReminders = new Set<string>();

interface ParsedTrigger {
  trigger: DateTime;
  anchor: {
    type: TaskNotesAnchorType;
    time: DateTime;
  };
}

export function extractReminders(
  frontmatter: unknown,
  ctx: TaskNotesContext,
): Array<Reminder> {
  if (!isRecord(frontmatter) || isExcluded(ctx.filePath, ctx.options)) {
    return [];
  }

  if (
    ctx.options.identificationMode !== "reminders" &&
    !isIdentified(frontmatter, ctx)
  ) {
    return [];
  }
  if (
    (ctx.options.skipCompleted && isCompleted(frontmatter, ctx.options)) ||
    (ctx.options.skipArchived && hasTag(ctx.tags, ctx.options.archiveTag))
  ) {
    return [];
  }

  const remindersValue = frontmatter[ctx.options.properties.reminders];
  if (!Array.isArray(remindersValue)) {
    if (ctx.options.identificationMode === "reminders") {
      return [];
    }
    if (hasValue(remindersValue)) {
      warn(ctx, "<reminders>", "the reminders property is not a list");
    }
    return [];
  }

  const seenIds = new Set<string>();
  const parsed: Array<Reminder> = [];
  remindersValue.forEach((value, index) => {
    const rawId = isRecord(value) ? coerceScalar(value["id"]) : undefined;
    const warningId = rawId?.trim() || `<item-${index}>`;
    if (!isRecord(value)) {
      warn(ctx, warningId, "reminder entry is not an object");
      return;
    }
    const id = coerceScalar(value["id"])?.trim();
    if (!id) {
      warn(ctx, warningId, "reminder id is missing or empty");
      return;
    }
    if (seenIds.has(id)) {
      warn(ctx, id, "duplicate reminder id");
      return;
    }
    seenIds.add(id);

    const reminder = parseReminder(value, id, frontmatter, ctx);
    if (reminder) {
      parsed.push(reminder);
    }
  });

  if (ctx.options.identificationMode === "reminders" && parsed.length === 0) {
    return [];
  }

  const title =
    coerceScalar(frontmatter[ctx.options.properties.title])?.trim() ||
    ctx.fileName;
  const now = ctx.now ?? DateTime.now();
  const oldest = now.add(-Math.max(0, ctx.options.ignoreOlderThanDays), "days");
  const recurringInstanceDates =
    ctx.options.skipRecurringInstances &&
    hasValue(frontmatter[ctx.options.properties.recurrence])
      ? collectRecurringInstanceDates(frontmatter, ctx.options)
      : new Set<string>();
  const result = parsed.filter((reminder) => {
    const task = reminder.tasknotes!;
    if (recurringInstanceDates.has(task.anchor.time.toYYYYMMDD())) {
      return false;
    }
    const effectiveTime =
      ctx.effectiveTimeFor?.(task.reminderId, reminder.time) ?? reminder.time;
    if (effectiveTime.getTimeInMillis() < oldest.getTimeInMillis()) {
      return false;
    }
    reminder.effectiveTime = effectiveTime;
    task.taskTitle = title;
    reminder.title = task.description || title;
    return true;
  });

  result.sort((a, b) => {
    const timeDifference = a.time.getTimeInMillis() - b.time.getTimeInMillis();
    if (timeDifference !== 0) {
      return timeDifference;
    }
    return a.tasknotes!.reminderId.localeCompare(b.tasknotes!.reminderId);
  });
  return result;
}

function parseReminder(
  value: Record<string, unknown>,
  id: string,
  frontmatter: Record<string, unknown>,
  ctx: TaskNotesContext,
): Reminder | undefined {
  const type = coerceScalar(value["type"]);
  const description = coerceScalar(value["description"])?.trim() || undefined;
  let parsedTrigger: ParsedTrigger | undefined;

  if (type === "absolute") {
    if (
      hasValue(value["relatedTo"]) ||
      hasValue(value["offset"]) ||
      !hasValue(value["absoluteTime"])
    ) {
      warn(ctx, id, "absolute reminder has missing or mixed fields");
      return undefined;
    }
    const absoluteTime = parseDateTime(value["absoluteTime"]);
    if (!absoluteTime) {
      warn(ctx, id, "absoluteTime is not a valid datetime");
      return undefined;
    }
    parsedTrigger = {
      trigger: absoluteTime,
      anchor: { type: "absolute", time: absoluteTime },
    };
  } else if (type === "relative") {
    if (
      hasValue(value["absoluteTime"]) ||
      !hasValue(value["relatedTo"]) ||
      !hasValue(value["offset"])
    ) {
      warn(ctx, id, "relative reminder has missing or mixed fields");
      return undefined;
    }
    const relatedTo = coerceScalar(value["relatedTo"]);
    if (relatedTo !== "due" && relatedTo !== "scheduled") {
      warn(ctx, id, "relatedTo must be due or scheduled");
      return undefined;
    }
    const anchorValue = frontmatter[ctx.options.properties[relatedTo]];
    const anchor = parseAnchor(anchorValue, ctx.options.dateOnlyAnchorTime);
    const duration = coerceScalar(value["offset"]);
    const offset = duration ? parseDuration(duration) : undefined;
    if (!anchor) {
      warn(ctx, id, `${relatedTo} anchor is missing or invalid`);
      return undefined;
    }
    if (!offset) {
      warn(ctx, id, "offset is not a valid ISO 8601 duration");
      return undefined;
    }
    parsedTrigger = {
      trigger: applyDuration(anchor, offset),
      anchor: { type: relatedTo, time: anchor },
    };
  } else {
    warn(ctx, id, "type must be absolute or relative");
    return undefined;
  }

  return new Reminder(
    ctx.filePath,
    description ?? ctx.fileName,
    parsedTrigger.trigger,
    -1,
    false,
    "tasknotes",
    {
      reminderId: id,
      description,
      anchor: parsedTrigger.anchor,
      taskTitle: ctx.fileName,
    },
  );
}

function parseAnchor(value: unknown, dateOnlyAnchorTime: string) {
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

function parseDateTime(value: unknown) {
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

function parseDuration(value: string) {
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

function applyDuration(
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

function isIdentified(
  frontmatter: Record<string, unknown>,
  ctx: TaskNotesContext,
) {
  if (ctx.options.identificationMode === "tag") {
    return hasTag(ctx.tags, ctx.options.tag);
  }
  if (ctx.options.identificationMode === "property") {
    const property = ctx.options.identificationProperty.trim();
    if (
      !property ||
      !Object.prototype.hasOwnProperty.call(frontmatter, property)
    ) {
      return false;
    }
    const expected = ctx.options.identificationValue.trim();
    if (expected.length === 0) {
      return true;
    }
    const value = frontmatter[property];
    if (Array.isArray(value)) {
      return value.some(
        (item) => coerceScalar(item)?.toLowerCase() === expected.toLowerCase(),
      );
    }
    return coerceScalar(value)?.toLowerCase() === expected.toLowerCase();
  }
  return true;
}

function isCompleted(
  frontmatter: Record<string, unknown>,
  options: TaskNotesOptions,
) {
  const status = frontmatter[options.properties.status];
  if (status === true) {
    return true;
  }
  const normalizedStatus = coerceScalar(status)?.toLowerCase();
  if (
    normalizedStatus &&
    options.completedStatuses.some(
      (completed) => completed.trim().toLowerCase() === normalizedStatus,
    )
  ) {
    return true;
  }
  const completedDate = frontmatter[options.properties.completedDate];
  return (
    !hasValue(frontmatter[options.properties.recurrence]) &&
    hasValue(completedDate)
  );
}

function collectRecurringInstanceDates(
  frontmatter: Record<string, unknown>,
  options: TaskNotesOptions,
): Set<string> {
  const dates = new Set<string>();
  [
    options.properties.completeInstances,
    options.properties.skippedInstances,
  ].forEach((property) => collectDateStrings(frontmatter[property], dates));
  return dates;
}

function collectDateStrings(value: unknown, dates: Set<string>): void {
  if (Array.isArray(value)) {
    value.forEach((item) => collectDateStrings(item, dates));
    return;
  }
  if (isRecord(value)) {
    Object.entries(value).forEach(([key, item]) => {
      collectDateStrings(key, dates);
      collectDateStrings(item, dates);
    });
    return;
  }
  const scalar = coerceScalar(value)?.trim();
  if (!scalar) {
    return;
  }
  const date = /^(\d{4}-\d{2}-\d{2})(?:T.*)?$/.exec(scalar)?.[1];
  if (date && isValidDateString(date)) {
    dates.add(date);
  }
}

function isValidDateString(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return false;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const daysInMonth = [
    31,
    isLeapYear(year) ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];
  return (
    month >= 1 &&
    month <= 12 &&
    day >= 1 &&
    day <= (daysInMonth[month - 1] ?? 0)
  );
}

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function isExcluded(filePath: string, options: TaskNotesOptions) {
  const normalizedPath = filePath.replace(/\\/g, "/");
  return options.excludedFolders.some((folder) => {
    const normalizedFolder = folder.replace(/\\/g, "/").replace(/^\/|\/$/g, "");
    return (
      normalizedFolder.length > 0 &&
      (normalizedPath === normalizedFolder ||
        normalizedPath.startsWith(`${normalizedFolder}/`))
    );
  });
}

function hasTag(tags: Array<string>, expected: string) {
  const normalizedExpected = expected.replace(/^#/, "").toLowerCase();
  if (!normalizedExpected) {
    return false;
  }
  return tags.some(
    (tag) => tag.replace(/^#/, "").toLowerCase() === normalizedExpected,
  );
}

function hasValue(value: unknown) {
  if (value === undefined || value === null) {
    return false;
  }
  if (typeof value === "string") {
    return value.trim().length > 0;
  }
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  if (isRecord(value)) {
    return Object.keys(value).length > 0;
  }
  return true;
}

function coerceScalar(value: unknown): string | undefined {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  if (typeof value === "boolean") {
    return String(value);
  }
  if (value instanceof Date && Number.isFinite(value.getTime())) {
    return value.toISOString();
  }
  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    !(value instanceof Date)
  );
}

function warn(ctx: TaskNotesContext, id: string, reason: string) {
  const key = `${ctx.filePath}::${id}`;
  if (ctx.warnOnce) {
    ctx.warnOnce(key, `Skipping TaskNotes reminder ${key}: ${reason}`);
    return;
  }
  if (!warnedInvalidReminders.has(key)) {
    warnedInvalidReminders.add(key);
    console.warn(`Skipping TaskNotes reminder ${key}: ${reason}`);
  }
}
