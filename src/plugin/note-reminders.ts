import { NoteReminderReader, extractFrontmatterText } from "model/note/reader";
import type {
  ApplyOutcome,
  Frontmatter,
  NoteReminderAction,
} from "model/note/store";
import type { NoteReminderOrigin, Reminder } from "model/reminder";

/**
 * What `NoteReminderService` needs from Obsidian, injected so the service
 * can be tested with fakes (see `.claude/rules/testing.md`).
 */
export interface NoteReminderServiceDeps {
  parseYaml(yaml: string): unknown;
  /** The current text of the note at `path`. Rejects when it is missing. */
  readFile(path: string): Promise<string>;
  /**
   * Rewrites the frontmatter of the note at `path` (Obsidian's
   * `FileManager.processFrontMatter`): reads, calls `fn`, and saves in one
   * step. Writes nothing when `fn` throws. Rejects when the note is missing
   * or its frontmatter can't be parsed.
   */
  processFrontMatter(
    path: string,
    fn: (frontmatter: Frontmatter) => void,
  ): Promise<void>;
}

/**
 * What became of a write. The first four come from the store; `failed`
 * means the note could not be read or written at all.
 */
export type WriteResult = ApplyOutcome | "failed";

/** Thrown inside the frontmatter callback to make Obsidian write nothing. */
class NothingToWrite extends Error {
  constructor(readonly outcome: ApplyOutcome) {
    super("nothing to write");
  }
}

/**
 * Reads note reminders out of a note's content and writes "Done" / "Remind
 * me later" back to its frontmatter.
 *
 * Reading works on the file's text rather than Obsidian's metadata cache:
 * the cache is still stale when the vault's `modify` event fires, so a cache
 * read right after a write would bring the just-handled reminder back.
 */
export class NoteReminderService {
  constructor(
    private reader: NoteReminderReader,
    private deps: NoteReminderServiceDeps,
  ) {}

  /** The pending note reminders in a note whose text is `content`. */
  read(path: string, content: string): Array<Reminder> {
    const text = extractFrontmatterText(content);
    if (text == null || !this.reader.mightContainReminders(text)) {
      return [];
    }
    let fm: unknown;
    try {
      fm = this.deps.parseYaml(text);
    } catch (e) {
      // A half-typed edit. The note has no note reminders until it parses.
      console.debug("Cannot parse frontmatter: file=%s, error=%o", path, e);
      return [];
    }
    return isFrontmatter(fm) ? this.reader.read(path, fm) : [];
  }

  /**
   * The note's frontmatter as it is on disk now (`{}` when it has none).
   * Rejects when the note is missing or its frontmatter is not valid YAML.
   */
  async readFrontmatter(path: string): Promise<Frontmatter> {
    const text = extractFrontmatterText(await this.deps.readFile(path));
    if (text == null) {
      return {};
    }
    const fm = this.deps.parseYaml(text);
    return isFrontmatter(fm) ? fm : {};
  }

  /**
   * Writes `action` for `reminder` to its note. The in-memory reminders are
   * not touched here: a write triggers the vault's `modify` event, and the
   * reload that follows is what removes or moves the reminder, exactly as
   * for an edit made by hand.
   */
  apply(reminder: Reminder, action: NoteReminderAction): Promise<WriteResult> {
    const origin = reminder.origin;
    if (origin.kind !== "note") {
      return Promise.resolve("missing");
    }
    return this.applyAt(reminder.file, origin, action);
  }

  /** Writes `action` for the reminder at `origin` in the note at `path`. */
  applyAt(
    path: string,
    origin: NoteReminderOrigin,
    action: NoteReminderAction,
  ): Promise<WriteResult> {
    return this.write(path, (fm) => this.reader.apply(fm, origin, action));
  }

  /**
   * Rewrites the frontmatter of the note at `path` with `fn`, which changes
   * the object it is given only when it returns `applied`.
   *
   * `fn` runs twice. Obsidian's frontmatter API rewrites (and so reformats)
   * the block even when the callback changes nothing, so `fn` first runs on
   * a parsed copy and the API is entered only when there is something to
   * write. Inside the API `fn` runs again on what is on disk at that moment;
   * if the note changed in between and there is nothing to write after all,
   * a thrown marker makes Obsidian leave the file alone.
   */
  async write(
    path: string,
    fn: (fm: Frontmatter) => ApplyOutcome,
  ): Promise<WriteResult> {
    try {
      const firstRun = fn(await this.readFrontmatter(path));
      if (firstRun !== "applied") {
        return firstRun;
      }
      await this.deps.processFrontMatter(path, (fm) => {
        const outcome = fn(fm);
        if (outcome !== "applied") {
          throw new NothingToWrite(outcome);
        }
      });
      return "applied";
    } catch (e) {
      if (e instanceof NothingToWrite) {
        return e.outcome;
      }
      console.error("Cannot update note reminder: path=%s, error=%o", path, e);
      return "failed";
    }
  }
}

function isFrontmatter(value: unknown): value is Frontmatter {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
