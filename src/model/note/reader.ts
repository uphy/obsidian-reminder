import { Reminder } from "model/reminder";
import type { NoteReminderOrigin } from "model/reminder";
import type {
  ApplyOutcome,
  Frontmatter,
  NoteReminderAction,
  NoteReminderFormat,
} from "./format";

// The empty block (the closing line right after the opening one) is its own
// alternative, tried first: as an optional group it would only be reached
// when no later `---` line exists, and body text up to that line would be
// read as frontmatter.
const FRONTMATTER = /^---\r?\n(?:---|([\s\S]*?)\r?\n---)[ \t]*(?:\r?\n|$)/;

/**
 * Returns the YAML text of a note's frontmatter block: what is between a
 * first line that is exactly `---` and the next line that is `---` followed
 * only by spaces. Null when the note has no such block.
 */
export function extractFrontmatterText(content: string): string | null {
  const match = FRONTMATTER.exec(content);
  return match == null ? null : (match[1] ?? "");
}

/** The note name: the last path segment without a final `.md`. */
export function noteNameOf(path: string): string {
  const segments = path.split("/");
  return segments[segments.length - 1]!.replace(/\.md$/i, "");
}

/** Turns frontmatter into `Reminder`s through every configured format. */
export class NoteReminderReader {
  constructor(private formats: Array<NoteReminderFormat>) {}

  /**
   * Cheap pre-check on the raw YAML text, so that a note that cannot hold a
   * note reminder is never parsed.
   */
  mightContainReminders(frontmatterText: string): boolean {
    return this.formats.some((format) =>
      format.keys().some((key) => frontmatterText.includes(key)),
    );
  }

  read(file: string, fm: Frontmatter): Array<Reminder> {
    const reminders: Array<Reminder> = [];
    for (const format of this.formats) {
      for (const entry of format.read(fm)) {
        reminders.push(
          Reminder.ofNote(file, entry.title ?? noteNameOf(file), entry.time, {
            kind: "note",
            format: format.id,
            key: entry.key,
            label: entry.label,
          }),
        );
      }
    }
    return reminders;
  }

  apply(
    fm: Frontmatter,
    origin: NoteReminderOrigin,
    action: NoteReminderAction,
  ): ApplyOutcome {
    const format = this.formats.find((s) => s.id === origin.format);
    return format == null ? "missing" : format.apply(fm, origin.key, action);
  }

  /** The properties of `origin`'s format that belong to another plugin. */
  externalProperties(origin: NoteReminderOrigin): Array<string> {
    const format = this.formats.find((s) => s.id === origin.format);
    return format?.externalProperties?.() ?? [];
  }
}
