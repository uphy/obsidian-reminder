import { isValidRecurrence, nextOccurrence } from "model/format/recurrence";
import { moment } from "model/moment";
import { DateTime } from "model/time";
import {
  DONE_SUFFIX,
  OCCURRENCE_SUFFIX,
  REPEAT_SUFFIX,
  TITLE_SUFFIX,
} from "./sources";
import type { NoteReminderSource } from "./sources";
import type {
  ApplyOutcome,
  Frontmatter,
  NoteReminderAction,
  NoteReminderEntry,
  NoteReminderStore,
} from "./store";
import {
  formatTimeValue,
  inShapeOf,
  isBeforeDay,
  isEmptyValue,
  parseTimeValue,
  sameTime,
} from "./value";

/**
 * Reminders written as a plain date or date-time property.
 *
 * For a property `p`:
 *
 * - `p` holds the time. Empty means "nothing scheduled".
 * - `p-done` holds the value of `p` that "Done" was last pressed for. "Done"
 *   never edits `p`: the reminder is pending while the two differ, so writing
 *   a new date into `p` (by hand, in a Bases table, or by another plugin)
 *   makes it pending again without anyone having to clear a flag.
 * - `p-title` replaces the note name as the title, for a property the plugin
 *   manages.
 * - `p-repeat` holds a recurrence rule (`every month`), for a property the
 *   plugin manages. "Done" then also moves `p` to the next occurrence.
 * - `p-occurrence` exists between a snooze and the next "Done" of a
 *   repeating reminder: `<occurrence>/<snoozed time>`. It keeps the series
 *   on its own dates when one occurrence was postponed. It counts only while
 *   `p` still holds the snoozed time, so a date edited by hand afterwards
 *   starts the series from that date.
 */
export class PropertyNoteReminderStore implements NoteReminderStore {
  readonly id = "property";

  constructor(private sources: () => Array<NoteReminderSource>) {}

  keys(): Array<string> {
    return this.sources().map((source) => source.property);
  }

  read(fm: Frontmatter): Array<NoteReminderEntry> {
    const entries: Array<NoteReminderEntry> = [];
    for (const source of this.sources()) {
      const property = source.property;
      const time = parseTimeValue(fm[property]);
      if (time == null || isBeforeDay(time, source.since)) {
        continue;
      }
      const done = parseTimeValue(fm[property + DONE_SUFFIX]);
      if (done != null && sameTime(done, time)) {
        continue;
      }
      const title = source.managed ? textOf(fm[property + TITLE_SUFFIX]) : "";
      entries.push({
        key: property,
        time,
        title: title !== "" ? title : undefined,
        label: property,
      });
    }
    return entries;
  }

  apply(
    fm: Frontmatter,
    key: string,
    action: NoteReminderAction,
  ): ApplyOutcome {
    const source = this.sources().find((source) => source.property === key);
    if (source == null) {
      return "missing";
    }
    const current = parseTimeValue(fm[key]);
    if (current == null) {
      return "missing";
    }
    // The stale check: the notification was shown for `expected`. If the
    // note holds another time by now, or that time is already recorded as
    // done, the action is about a reminder that no longer exists.
    if (!sameTime(current, action.expected)) {
      return "stale";
    }
    const doneValue = fm[key + DONE_SUFFIX];
    const done = parseTimeValue(doneValue);
    if (done != null && sameTime(done, current)) {
      return "stale";
    }

    if (action.type === "snooze") {
      const next = inShapeOf(action.time, current.hasTimePart);
      if (formatTimeValue(next) === formatTimeValue(current)) {
        // "Next Saturday" on a Saturday: the note already holds this time.
        // The written text is compared, because a date made from a
        // date-time still carries that time of day.
        // Reporting it as written would leave the reminder muted for good,
        // because the reload after the write finds nothing changed.
        return "unchanged";
      }
      const rule = source.managed ? repeatRuleOf(fm, key) : "";
      const occurrence = postponedOccurrence(fm, key, current) ?? current;
      fm[key] = formatTimeValue(next);
      if (done != null && sameTime(done, next)) {
        // Otherwise the chosen time would count as handled and never show.
        delete fm[key + DONE_SUFFIX];
      }
      if (rule !== "") {
        // A second snooze keeps the occurrence the first one postponed.
        fm[key + OCCURRENCE_SUFFIX] =
          formatTimeValue(occurrence) + "/" + formatTimeValue(next);
      } else if (source.managed) {
        removeOccurrence(fm, key);
      }
      return "applied";
    }

    if (!isEmptyValue(doneValue) && done == null) {
      // `p-done` holds something that is not a time (the user's own checkbox
      // or text column of that name). It is not ours to overwrite.
      return "blocked";
    }
    if (source.managed) {
      const rule = repeatRuleOf(fm, key);
      if (isValidRecurrence(rule)) {
        const start = postponedOccurrence(fm, key, current) ?? current;
        const next = nextOccurrenceAfter(rule, start, action.now, current);
        if (next != null) {
          fm[key] = formatTimeValue(next);
        }
        // No next occurrence: the rule has ended, and the reminder is done.
      }
      removeOccurrence(fm, key);
    }
    fm[key + DONE_SUFFIX] = formatTimeValue(current);
    return "applied";
  }
}

/** The recurrence rule kept next to `property`, or "" when there is none. */
function repeatRuleOf(fm: Frontmatter, property: string): string {
  return textOf(fm[property + REPEAT_SUFFIX]);
}

/**
 * True when `property` has a recurrence rule the plugin can't read. "Done"
 * then only records the reminder as done, and the user should be told that
 * it will not come back.
 */
export function hasUnreadableRepeatRule(
  fm: Frontmatter,
  property: string,
): boolean {
  const rule = repeatRuleOf(fm, property);
  return rule !== "" && !isValidRecurrence(rule);
}

function parseOccurrence(
  value: unknown,
): { occurrence: DateTime; snoozed: DateTime } | null {
  if (typeof value !== "string") {
    return null;
  }
  const parts = value.split("/");
  if (parts.length !== 2) {
    return null;
  }
  const occurrence = parseTimeValue(parts[0]);
  const snoozed = parseTimeValue(parts[1]);
  return occurrence == null || snoozed == null ? null : { occurrence, snoozed };
}

/**
 * The occurrence a snooze postponed to `current`, or null when `current` is
 * not a snoozed time (no record, or the date was changed since the snooze).
 */
function postponedOccurrence(
  fm: Frontmatter,
  property: string,
  current: DateTime,
): DateTime | null {
  const record = parseOccurrence(fm[property + OCCURRENCE_SUFFIX]);
  return record != null && sameTime(record.snoozed, current)
    ? record.occurrence
    : null;
}

/** Removes `p-occurrence` unless it holds something the plugin didn't write. */
function removeOccurrence(fm: Frontmatter, property: string) {
  const key = property + OCCURRENCE_SUFFIX;
  if (
    key in fm &&
    (isEmptyValue(fm[key]) || parseOccurrence(fm[key]) != null)
  ) {
    delete fm[key];
  }
}

function isAfter(a: DateTime, b: DateTime): boolean {
  const format = a.hasTimePart ? "YYYY-MM-DDTHH:mm" : "YYYY-MM-DD";
  return a.format(format) > b.format(format);
}

/**
 * The occurrence of `rule` that follows the one just completed: the series
 * is stepped from `start`, skipping what is already past `now`, and the
 * result has to be later than `shown` (the time "Done" was pressed for).
 *
 * Without that last condition a reminder completed ahead of time could land
 * on the very time it was completed for, which is recorded as done: a daily
 * reminder snoozed to tomorrow and completed today would never show again.
 */
function nextOccurrenceAfter(
  rule: string,
  start: DateTime,
  now: DateTime,
  shown: DateTime,
): DateTime | null {
  const step = (from: DateTime): DateTime | null => {
    const date = nextOccurrence(rule, start.moment(), from);
    return date == null ? null : new DateTime(moment(date), start.hasTimePart);
  };
  let next = step(now);
  if (next != null && !isAfter(next, shown)) {
    next = step(shown);
  }
  return next != null && isAfter(next, shown) ? next : null;
}

/** What a note currently says about the reminder in `property`. */
export type PropertyReminderState = {
  time: DateTime | null;
  /**
   * The text of a value that is neither empty nor a time (text, a number, a
   * list). The dialog must not overwrite it.
   */
  foreignValue: string | null;
  title: string;
  /** The recurrence rule as written in the note; "" when there is none. */
  repeat: string;
  /** True when `time` is set and already recorded as done. */
  done: boolean;
  /**
   * True when `time` is set, not done, and not before the cut-off: the
   * reminder exists and will be (or was) shown.
   */
  pending: boolean;
};

export type PropertyReminderEdit = {
  time: DateTime;
  /** Empty removes the title property. */
  title: string;
  /** A recurrence rule. Empty removes the repeat property. */
  repeat: string;
};

// A multi-line YAML string would break the single-line places a title is
// shown in, so line breaks become spaces.
function textOf(value: unknown): string {
  return typeof value === "string"
    ? value.replace(/\s*[\r\n]+\s*/g, " ").trim()
    : "";
}

/**
 * Reads the state of the reminder in `property`. `since` is the cut-off of
 * its source (empty for none).
 */
export function readPropertyReminderState(
  fm: Frontmatter,
  property: string,
  since: string = "",
): PropertyReminderState {
  const value = fm[property];
  const time = parseTimeValue(value);
  const doneTime = parseTimeValue(fm[property + DONE_SUFFIX]);
  const done = time != null && doneTime != null && sameTime(time, doneTime);
  return {
    time,
    foreignValue:
      time == null && !isEmptyValue(value)
        ? typeof value === "string"
          ? value
          : JSON.stringify(value)
        : null,
    title: textOf(fm[property + TITLE_SUFFIX]),
    repeat: repeatRuleOf(fm, property),
    done,
    pending: time != null && !done && !isBeforeDay(time, since),
  };
}

/**
 * The property the dialog starts on: the first with a pending reminder, else
 * the first that holds a time, else the first.
 */
export function pickInitialProperty(
  properties: ReadonlyArray<string>,
  states: Readonly<Record<string, PropertyReminderState>>,
): string | undefined {
  return (
    properties.find((p) => states[p]?.pending) ??
    properties.find((p) => states[p]?.time != null) ??
    properties[0]
  );
}

/**
 * Sets (creates or edits) the reminder in `property`.
 *
 * Moving the reminder onto a time that is recorded as done clears the
 * record: choosing a time is a request to be reminded at it. Saving without
 * changing the time keeps the record, so that editing only the title of a
 * finished reminder does not bring it back (`rearmPropertyReminder` is the
 * explicit way to do that).
 *
 * Returns `blocked`, leaving `fm` untouched, when the property holds a value
 * that is not a time.
 */
export function setPropertyReminder(
  fm: Frontmatter,
  property: string,
  edit: PropertyReminderEdit,
): ApplyOutcome {
  const value = fm[property];
  const current = parseTimeValue(value);
  if (!isEmptyValue(value) && current == null) {
    return "blocked";
  }
  fm[property] = formatTimeValue(edit.time);
  const titleKey = property + TITLE_SUFFIX;
  if (isEmptyValue(fm[titleKey]) || typeof fm[titleKey] === "string") {
    // A title that is not text is someone else's value: leave it alone.
    const title = textOf(edit.title);
    if (title === "") {
      delete fm[titleKey];
    } else {
      fm[titleKey] = title;
    }
  }
  const repeatKey = property + REPEAT_SUFFIX;
  if (isEmptyValue(fm[repeatKey]) || typeof fm[repeatKey] === "string") {
    const repeat = textOf(edit.repeat);
    if (repeat === "") {
      delete fm[repeatKey];
    } else {
      fm[repeatKey] = repeat;
    }
  }
  const moved = current == null || !sameTime(current, edit.time);
  const done = parseTimeValue(fm[property + DONE_SUFFIX]);
  if (moved && done != null && sameTime(done, edit.time)) {
    delete fm[property + DONE_SUFFIX];
  }
  if (moved || repeatRuleOf(fm, property) === "") {
    // A time chosen here starts the series from that time.
    removeOccurrence(fm, property);
  }
  return "applied";
}

/**
 * Makes a reminder that is recorded as done pending again at the same time,
 * by removing the record. `stale` when there is nothing to undo.
 */
export function rearmPropertyReminder(
  fm: Frontmatter,
  property: string,
): ApplyOutcome {
  const time = parseTimeValue(fm[property]);
  if (time == null) {
    return "missing";
  }
  const done = parseTimeValue(fm[property + DONE_SUFFIX]);
  if (done == null || !sameTime(done, time)) {
    return "stale";
  }
  delete fm[property + DONE_SUFFIX];
  return "applied";
}

/**
 * Removes the reminder in `property` together with the companions the plugin
 * wrote. A companion that holds something the plugin would not have written
 * stays. Returns `blocked`, leaving `fm` untouched, when the property holds
 * a value that is not a time, and `missing` when it holds nothing.
 */
export function removePropertyReminder(
  fm: Frontmatter,
  property: string,
): ApplyOutcome {
  const value = fm[property];
  if (isEmptyValue(value) && !(property in fm)) {
    return "missing";
  }
  if (!isEmptyValue(value) && parseTimeValue(value) == null) {
    return "blocked";
  }
  delete fm[property];
  const titleKey = property + TITLE_SUFFIX;
  if (isEmptyValue(fm[titleKey]) || typeof fm[titleKey] === "string") {
    delete fm[titleKey];
  }
  const doneKey = property + DONE_SUFFIX;
  if (isEmptyValue(fm[doneKey]) || parseTimeValue(fm[doneKey]) != null) {
    delete fm[doneKey];
  }
  const repeatKey = property + REPEAT_SUFFIX;
  if (isEmptyValue(fm[repeatKey]) || typeof fm[repeatKey] === "string") {
    delete fm[repeatKey];
  }
  removeOccurrence(fm, property);
  return "applied";
}
