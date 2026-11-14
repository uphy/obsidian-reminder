import type { DateTime } from "model/time";
import { DONE_SUFFIX, TITLE_SUFFIX } from "./sources";
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
    if (!this.sources().some((source) => source.property === key)) {
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
      fm[key] = formatTimeValue(next);
      if (done != null && sameTime(done, next)) {
        // Otherwise the chosen time would count as handled and never show.
        delete fm[key + DONE_SUFFIX];
      }
      return "applied";
    }

    if (!isEmptyValue(doneValue) && done == null) {
      // `p-done` holds something that is not a time (the user's own checkbox
      // or text column of that name). It is not ours to overwrite.
      return "blocked";
    }
    fm[key + DONE_SUFFIX] = formatTimeValue(current);
    return "applied";
  }
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
  const moved = current == null || !sameTime(current, edit.time);
  const done = parseTimeValue(fm[property + DONE_SUFFIX]);
  if (moved && done != null && sameTime(done, edit.time)) {
    delete fm[property + DONE_SUFFIX];
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
  return "applied";
}
