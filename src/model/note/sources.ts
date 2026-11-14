export const DONE_SUFFIX = "-done";
export const TITLE_SUFFIX = "-title";

/**
 * Suffixes of the properties the plugin keeps next to a source property.
 * `-repeat` and `-occurrence` are reserved for recurrence, so that a source
 * can never be named after them.
 */
export const COMPANION_SUFFIXES = [
  DONE_SUFFIX,
  TITLE_SUFFIX,
  "-repeat",
  "-occurrence",
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

const DAY = /^\d{4}-\d{2}-\d{2}$/;

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
      since: typeof since === "string" && DAY.test(since) ? since : "",
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
