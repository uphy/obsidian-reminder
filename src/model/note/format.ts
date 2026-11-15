import type { DateTime } from "model/time";

/** A note's parsed frontmatter. Values are whatever the YAML parser returned. */
export type Frontmatter = Record<string, unknown>;

/** One note-level reminder as a format read it from a note's frontmatter. */
export type NoteReminderEntry = {
  /**
   * Identifies the reminder within its note and format (a property name).
   * Stable across edits of the time.
   */
  key: string;
  time: DateTime;
  /** Overrides the note name as the reminder's title. */
  title?: string;
  /**
   * Short text shown next to the title: which of the note reminders this
   * is. Empty when there is nothing to tell apart.
   */
  label: string;
};

/**
 * An action taken on a notification. `expected` is the time the notification
 * was shown for: if the note no longer holds it (another plugin moved the
 * date, a second device handled it), the action must not touch the note.
 */
export type NoteReminderAction =
  | { type: "done"; expected: DateTime; now: DateTime }
  | { type: "snooze"; expected: DateTime; time: DateTime };

/**
 * - `applied`: the frontmatter object was changed.
 * - `unchanged`: a snooze chose the time the reminder already has, so there
 *   is nothing to write and the reminder is still due.
 * - `stale`: the reminder exists but is not pending at `expected` (the value
 *   changed, or it is already recorded as done).
 * - `missing`: the reminder is gone.
 * - `blocked`: a companion property holds a value the plugin must not
 *   overwrite.
 */
export type ApplyOutcome =
  "applied" | "unchanged" | "stale" | "missing" | "blocked";

/**
 * A way of writing note-level reminders in frontmatter.
 *
 * A format is a pair of pure functions over a frontmatter object: it never
 * touches the vault, so it can be tested with plain objects. The plugin layer
 * (`plugin/note-reminders.ts`) does the reading and writing of files.
 */
export interface NoteReminderFormat {
  readonly id: string;
  /**
   * Frontmatter keys this format reads. A note whose frontmatter text contains
   * none of them is skipped without parsing its YAML.
   */
  keys(): Array<string>;
  /**
   * Pending (not yet handled) reminders in `fm`. The format applies its own
   * cut-off here.
   */
  read(fm: Frontmatter): Array<NoteReminderEntry>;
  /**
   * Applies `action` to the reminder `key` by mutating `fm`. `fm` is left
   * untouched unless the outcome is `applied`.
   */
  apply(fm: Frontmatter, key: string, action: NoteReminderAction): ApplyOutcome;
}
