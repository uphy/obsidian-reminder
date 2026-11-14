import type { Frontmatter } from "./format";
import { isBeforeDay, isDay, isEmptyValue, parseTimeValue } from "./value";

export const DONE_SUFFIX = "-done";
export const TITLE_SUFFIX = "-title";
export const REPEAT_SUFFIX = "-repeat";
export const OCCURRENCE_SUFFIX = "-occurrence";

/**
 * Suffixes of the properties the plugin keeps next to a source property. A
 * source can never be named after one of them.
 */
export const COMPANION_SUFFIXES = [
  DONE_SUFFIX,
  TITLE_SUFFIX,
  REPEAT_SUFFIX,
  OCCURRENCE_SUFFIX,
];

/** One property the user configured to be read as a reminder. */
export type NoteReminderSource = {
  /** Name of the date / date-time property. */
  property: string;
  /**
   * True when the plugin may create, edit and remove the value (the dialog
   * and the title). False for a property the user, Obsidian Bases or another
   * plugin writes: it is read, marked done and snoozed, never created or
   * removed.
   */
  managed: boolean;
  /**
   * The cut-off, `YYYY-MM-DD`. Values on days before it are not read. Empty
   * means there is none.
   */
  since: string;
};

/** Drops anything that is not a well-formed row (hand-edited data). */
export function normalizeSources(value: unknown): Array<NoteReminderSource> {
  if (!Array.isArray(value)) {
    return [];
  }
  const rows: Array<NoteReminderSource> = [];
  for (const raw of value) {
    if (typeof raw !== "object" || raw === null) {
      continue;
    }
    const row = raw as Record<string, unknown>;
    const property =
      typeof row["property"] === "string" ? row["property"].trim() : "";
    if (property === "" || rows.some((r) => r.property === property)) {
      continue;
    }
    const since = row["since"];
    rows.push({
      property,
      managed: row["managed"] === true,
      since: typeof since === "string" && isDay(since) ? since : "",
    });
  }
  return rows;
}

/**
 * Why `name` can't be the property of row `index` (-1 for a new row), or
 * null when it can.
 *
 * - `empty`: no name.
 * - `duplicate`: another row already reads it.
 * - `companion`: it is a companion property of another row, or another row
 *   is a companion of it (`follow-up-done` next to `follow-up`). Reading both
 *   would turn the plugin's own record into a reminder.
 */
export function validateSourceName(
  rows: ReadonlyArray<NoteReminderSource>,
  index: number,
  name: string,
): "empty" | "duplicate" | "companion" | null {
  const property = name.trim();
  if (property === "") {
    return "empty";
  }
  const others = rows.filter((_, i) => i !== index).map((r) => r.property);
  if (others.includes(property)) {
    return "duplicate";
  }
  for (const other of others) {
    for (const suffix of COMPANION_SUFFIXES) {
      if (property === other + suffix || other === property + suffix) {
        return "companion";
      }
    }
  }
  return null;
}

/**
 * The rows after letting the reminder dialog manage `property`: an existing
 * row is switched to managed, keeping its cut-off (resetting it would hide
 * the reminders the property already holds on earlier days), and a new name
 * is added as a managed row with `since` as its cut-off (see
 * `newSourceCutOff`).
 * Null when the name can't be a source (it is a companion of another row).
 */
export function withManagedSource(
  rows: ReadonlyArray<NoteReminderSource>,
  property: string,
  since: string,
): Array<NoteReminderSource> | null {
  const index = rows.findIndex((row) => row.property === property);
  if (index >= 0) {
    return rows.map((row, i) =>
      i === index ? { ...row, managed: true } : row,
    );
  }
  if (validateSourceName(rows, -1, property) != null) {
    return null;
  }
  return [...rows, { property, managed: true, since }];
}

/** Display-only numbers about a source, shown on the settings page. */
export type NoteReminderSourceCounts = {
  /** Notes whose value is a time before the cut-off, so it is not read. */
  ignored: number;
  /**
   * Notes whose `-done` property holds something that is not a time (the
   * user's own checkbox or text), so "Done" can't be recorded there.
   */
  foreignDone: number;
};

/** Counts, over the frontmatter of the notes given, what `source` skips. */
export function countSourceStats(
  source: NoteReminderSource,
  frontmatters: Iterable<Frontmatter>,
): NoteReminderSourceCounts {
  let ignored = 0;
  let foreignDone = 0;
  for (const fm of frontmatters) {
    const time = parseTimeValue(fm[source.property]);
    if (time != null && isBeforeDay(time, source.since)) {
      ignored++;
    }
    const done = fm[source.property + DONE_SUFFIX];
    if (!isEmptyValue(done) && parseTimeValue(done) == null) {
      foreignDone++;
    }
  }
  return { ignored, foreignDone };
}

/**
 * The cut-off a property gets when it is added to the list. It is `today`
 * (`YYYY-MM-DD`) when a note already holds a value of that property dated
 * before today: those would otherwise all notify at once. A property with
 * no such value gets no cut-off, so the setting stays empty until it has
 * something to say.
 *
 * `frontmatters` has to cover every note of the vault, the ones under an
 * excluded path too (they are read as soon as the path is no longer
 * excluded). Pass null when that is not known, for example while Obsidian is
 * still indexing: the answer is then `today`, the safe side.
 */
export function newSourceCutOff(
  property: string,
  today: string,
  frontmatters: Iterable<Frontmatter> | null,
): string {
  if (frontmatters == null) {
    return today;
  }
  const past = countSourceStats(
    { property, managed: false, since: today },
    frontmatters,
  ).ignored;
  return past > 0 ? today : "";
}

/**
 * Whether the note already holds a time in one of the managed properties,
 * pending or not. It decides how the entry points to the reminder dialog
 * read: "set a reminder" for a note without one, "edit" for a note with one.
 */
export function hasManagedValue(
  sources: ReadonlyArray<NoteReminderSource>,
  frontmatter: Frontmatter | undefined,
): boolean {
  if (frontmatter == null) {
    return false;
  }
  return sources.some(
    (source) =>
      source.managed && parseTimeValue(frontmatter[source.property]) != null,
  );
}
