import { Reminder } from "model/reminder";
import type { NoteReminderOrigin } from "model/reminder";
import type {
  ApplyOutcome,
  Frontmatter,
  NoteReminderAction,
  NoteReminderStore,
} from "./store";

const FRONTMATTER = /^---\r?\n(?:([\s\S]*?)\r?\n)?---[ \t]*(?:\r?\n|$)/;

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

/** Turns frontmatter into `Reminder`s through every configured store. */
export class NoteReminderReader {
  constructor(private stores: Array<NoteReminderStore>) {}

  /**
   * Cheap pre-check on the raw YAML text, so that a note that cannot hold a
   * note reminder is never parsed.
   */
  mightContainReminders(frontmatterText: string): boolean {
    return this.stores.some((store) =>
      store.keys().some((key) => frontmatterText.includes(key)),
    );
  }

  read(file: string, fm: Frontmatter): Array<Reminder> {
    const reminders: Array<Reminder> = [];
    for (const store of this.stores) {
      for (const entry of store.read(fm)) {
        reminders.push(
          Reminder.ofNote(file, entry.title ?? noteNameOf(file), entry.time, {
            kind: "note",
            store: store.id,
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
    const store = this.stores.find((s) => s.id === origin.store);
    return store == null ? "missing" : store.apply(fm, origin.key, action);
  }
}
