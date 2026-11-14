import { moment } from "model/moment";
import { DateTime } from "model/time";
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

/** The list property TaskNotes keeps a task's reminders in. */
export const TASKNOTES_REMINDERS = "reminders";
/** Where this plugin records which of those reminders were handled. */
export const TASKNOTES_DONE = "reminders-done";
/** Id prefix of the one kind of entry this plugin adds to `reminders`. */
export const SNOOZE_ID_PREFIX = "obsidian-reminder-snooze-";

const ARCHIVED_TAG = "archived";
const OFFSET =
  /^([-+]?)P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/;

export type TaskNotesOptions = {
  enabled: boolean;
  /** The tag that makes a note a TaskNotes task, without `#`. */
  taskTag: string;
  /** Values of `status` that mean the task is completed. */
  completedStatuses: Array<string>;
  /** The cut-off, `YYYY-MM-DD`; empty means there is none. */
  since: string;
};

type Entry = Record<string, unknown>;

type DoneRecord = { id: string; time: DateTime };

/** What a task note says about its reminders, after the checks of `read`. */
type TaskNote = {
  entries: Array<Entry>;
  records: Array<DoneRecord>;
  /**
   * True when `reminders-done` holds something this plugin did not write. It
   * is then read as empty and never written.
   */
  foreignRecords: boolean;
};

/**
 * Reminders the TaskNotes plugin keeps in a task note's `reminders` list.
 *
 * An entry is either absolute (a time) or relative (an offset from the
 * task's `due` or `scheduled` date). TaskNotes owns the list, so this store
 * changes as little of it as it can:
 *
 * - "Done" appends `<id>@<time>` to `reminders-done` and leaves the entry
 *   alone. A relative entry is pending again when its base date moves,
 *   because the record then no longer matches its time.
 * - Snooze records the entry as done and adds one absolute entry of its own
 *   (id `obsidian-reminder-snooze-<original id>`). That entry counts only
 *   while the original is still recorded as done at its current time, and
 *   every write removes the ones that no longer count.
 */
export class TaskNotesReminderStore implements NoteReminderStore {
  readonly id = "tasknotes";

  constructor(private options: () => TaskNotesOptions) {}

  keys(): Array<string> {
    return this.options().enabled ? [TASKNOTES_REMINDERS] : [];
  }

  read(fm: Frontmatter): Array<NoteReminderEntry> {
    const note = this.parse(fm);
    if (note == null) {
      return [];
    }
    const title = typeof fm["title"] === "string" ? fm["title"].trim() : "";
    const entries: Array<NoteReminderEntry> = [];
    for (const { entry, time } of this.pending(fm, note)) {
      const description = entry["description"];
      entries.push({
        key: idOf(entry),
        time,
        title: title !== "" ? title : undefined,
        label:
          typeof description === "string" && description.trim() !== ""
            ? description.trim()
            : "TaskNotes",
      });
    }
    return entries;
  }

  apply(
    fm: Frontmatter,
    key: string,
    action: NoteReminderAction,
  ): ApplyOutcome {
    const note = this.parse(fm);
    if (note == null) {
      return "missing";
    }
    const entry = uniqueEntries(note.entries).find((e) => idOf(e) === key);
    const time = entry == null ? null : effectiveTime(entry, fm);
    if (entry == null || time == null) {
      return "missing";
    }
    // The stale check: the notification was shown for `expected`.
    if (
      !sameTime(time, action.expected) ||
      !this.pending(fm, note).some((p) => p.entry === entry)
    ) {
      return "stale";
    }

    const own = isOwnEntry(entry);
    const next =
      action.type === "snooze" ? inShapeOf(action.time, true) : undefined;
    if (next != null && sameTime(next, time)) {
      return "unchanged";
    }
    if (!own && note.foreignRecords) {
      // Handling an entry of TaskNotes means writing its record.
      return "blocked";
    }

    // Every write first drops the snooze entries that no longer count,
    // judged on the note as it is now. Judging them after the change would
    // bring a leftover back to life: recording the original at its new time
    // is exactly what makes a snooze entry count.
    let entries = note.entries.filter(
      (e) =>
        e === entry || !isOwnEntry(e) || originalTimeOf(e, fm, note) != null,
    );
    let records = note.records;
    if (own) {
      if (next == null) {
        // "Done" on a snoozed reminder: the original is already recorded.
        entries = entries.filter((e) => e !== entry);
      } else {
        entry["absoluteTime"] = formatTimeValue(next);
      }
    } else {
      records = [...records.filter((r) => r.id !== key), { id: key, time }];
      if (next != null) {
        const snoozeId = SNOOZE_ID_PREFIX + key;
        const added: Entry = {
          id: snoozeId,
          type: "absolute",
          absoluteTime: formatTimeValue(next),
        };
        if (typeof entry["description"] === "string") {
          added["description"] = entry["description"];
        }
        // Replaces what an earlier snooze of this entry left behind.
        entries = [...entries.filter((e) => idOf(e) !== snoozeId), added];
      }
    }
    // Records of entries that are gone go in the same write.
    records = records.filter((r) => entries.some((e) => idOf(e) === r.id));

    fm[TASKNOTES_REMINDERS] = entries;
    if (!note.foreignRecords) {
      if (records.length > 0) {
        fm[TASKNOTES_DONE] = records.map(formatRecord);
      } else {
        delete fm[TASKNOTES_DONE];
      }
    }
    return "applied";
  }

  /**
   * Null when the note is not a task this store reads: reading is off, the
   * note lacks the task tag, is completed, archived or recurring, or its
   * `reminders` holds something that is not a list of mappings.
   */
  private parse(fm: Frontmatter): TaskNote | null {
    const options = this.options();
    if (!options.enabled) {
      return null;
    }
    const tags = tagsOf(fm["tags"]);
    const taskTag = normalizeTag(options.taskTag);
    if (taskTag === "" || !tags.includes(taskTag)) {
      return null;
    }
    if (tags.includes(ARCHIVED_TAG)) {
      return null;
    }
    const status =
      typeof fm["status"] === "string" ? fm["status"].trim().toLowerCase() : "";
    if (
      options.completedStatuses.some((s) => s.trim().toLowerCase() === status)
    ) {
      return null;
    }
    if (!isEmptyValue(fm["recurrence"])) {
      // A recurring task moves its own dates on completion; which occurrence
      // a reminder belongs to is TaskNotes' business.
      return null;
    }
    const raw = fm[TASKNOTES_REMINDERS];
    if (!Array.isArray(raw) || !raw.every(isMapping)) {
      return null;
    }
    const done = fm[TASKNOTES_DONE];
    const records = parseRecords(done);
    return {
      entries: raw,
      records: records ?? [],
      foreignRecords: records == null,
    };
  }

  /** The entries that are reminders now, with their times. */
  private pending(
    fm: Frontmatter,
    note: TaskNote,
  ): Array<{ entry: Entry; time: DateTime }> {
    const since = this.options().since;
    const result: Array<{ entry: Entry; time: DateTime }> = [];
    for (const entry of uniqueEntries(note.entries)) {
      const time = effectiveTime(entry, fm);
      if (time == null || isBeforeDay(time, since)) {
        continue;
      }
      if (isOwnEntry(entry)) {
        if (originalTimeOf(entry, fm, note) == null) {
          continue;
        }
      } else if (isRecorded(note.records, idOf(entry), time)) {
        continue;
      }
      result.push({ entry, time });
    }
    return result;
  }
}

function isMapping(value: unknown): value is Entry {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function idOf(entry: Entry): string {
  return typeof entry["id"] === "string" ? entry["id"] : "";
}

/** Entries that have an id, the first of each id only. */
function uniqueEntries(entries: Array<Entry>): Array<Entry> {
  const seen = new Set<string>();
  return entries.filter((entry) => {
    const id = idOf(entry);
    if (id === "" || seen.has(id)) {
      return false;
    }
    seen.add(id);
    return true;
  });
}

function isOwnEntry(entry: Entry): boolean {
  return (
    idOf(entry).startsWith(SNOOZE_ID_PREFIX) && entry["type"] === "absolute"
  );
}

/**
 * For a snooze entry: the time of the entry it postpones, when that entry
 * is still recorded as done at its current time. Null means the snooze
 * entry no longer counts (the base date moved, or the original is gone).
 */
function originalTimeOf(
  own: Entry,
  fm: Frontmatter,
  note: TaskNote,
): DateTime | null {
  const originalId = idOf(own).slice(SNOOZE_ID_PREFIX.length);
  const original = uniqueEntries(note.entries).find(
    (e) => idOf(e) === originalId && !isOwnEntry(e),
  );
  const time = original == null ? null : effectiveTime(original, fm);
  return time != null && isRecorded(note.records, originalId, time)
    ? time
    : null;
}

/**
 * When an entry fires: its `absoluteTime`, or the task's `due` / `scheduled`
 * date plus its offset. A date without a time counts from midnight. Null
 * when it can't be computed (another type, a missing base date, a time with
 * a UTC offset, an offset this store can't read).
 */
export function effectiveTime(entry: Entry, fm: Frontmatter): DateTime | null {
  if (entry["type"] === "absolute") {
    const time = parseTimeValue(entry["absoluteTime"]);
    return time == null ? null : inShapeOf(time, true);
  }
  if (entry["type"] !== "relative") {
    return null;
  }
  const relatedTo = entry["relatedTo"];
  if (relatedTo !== "due" && relatedTo !== "scheduled") {
    return null;
  }
  const base = parseTimeValue(fm[relatedTo]);
  const offset = entry["offset"];
  if (base == null || typeof offset !== "string") {
    return null;
  }
  const match = OFFSET.exec(offset.trim());
  if (match == null) {
    return null;
  }
  const sign = match[1] === "-" ? -1 : 1;
  const m = inShapeOf(base, true).moment().clone();
  // Weeks and days are added as calendar units, so "one day before" a
  // 10:00 deadline stays at 10:00 across a clock change.
  m.add(sign * Number(match[2] ?? 0), "weeks");
  m.add(sign * Number(match[3] ?? 0), "days");
  m.add(sign * Number(match[4] ?? 0), "hours");
  m.add(sign * Number(match[5] ?? 0), "minutes");
  m.add(sign * Number(match[6] ?? 0), "seconds");
  return new DateTime(moment(m).seconds(0), true);
}

function isRecorded(
  records: Array<DoneRecord>,
  id: string,
  time: DateTime,
): boolean {
  return records.some((r) => r.id === id && sameTime(r.time, time));
}

function formatRecord(record: DoneRecord): string {
  return record.id + "@" + formatTimeValue(record.time);
}

/**
 * The records in a `reminders-done` value. Null when the value is something
 * this plugin did not write (not a list, or a list with an item that is not
 * `<id>@<time>`): it is then left alone.
 */
function parseRecords(value: unknown): Array<DoneRecord> | null {
  if (isEmptyValue(value)) {
    return [];
  }
  if (!Array.isArray(value)) {
    return null;
  }
  const records: Array<DoneRecord> = [];
  for (const item of value) {
    if (typeof item !== "string") {
      return null;
    }
    const at = item.lastIndexOf("@");
    const time = at <= 0 ? null : parseTimeValue(item.slice(at + 1));
    if (time == null) {
      return null;
    }
    records.push({ id: item.slice(0, at), time: inShapeOf(time, true) });
  }
  return records;
}

function normalizeTag(tag: string): string {
  return tag.trim().replace(/^#/, "").toLowerCase();
}

/** The tags of a note: a YAML list, or one string with commas or spaces. */
function tagsOf(value: unknown): Array<string> {
  const raw =
    typeof value === "string"
      ? value.split(/[,\s]+/)
      : Array.isArray(value)
        ? value.filter((v): v is string => typeof v === "string")
        : [];
  return raw.map(normalizeTag).filter((tag) => tag !== "");
}
