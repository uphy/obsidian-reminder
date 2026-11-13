import { coerceScalar, hasValue, isRecord } from "./values";

export function isCompleted(
  frontmatter: Record<string, unknown>,
  options: {
    properties: {
      status: string;
      completedDate: string;
      recurrence: string;
    };
    completedStatuses: Array<string>;
  },
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

export function collectRecurringInstanceDates(
  frontmatter: Record<string, unknown>,
  options: {
    properties: {
      completeInstances: string;
      skippedInstances: string;
    };
  },
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
