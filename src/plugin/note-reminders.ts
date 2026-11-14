import { NoteReminderReader, extractFrontmatterText } from "model/note/reader";
import type {
  ApplyOutcome,
  Frontmatter,
  NoteReminderAction,
} from "model/note/format";
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
  /**
   * Offers the new `value` of `property` in the note at `path` to the plugin
   * the property belongs to (see `NoteReminderFormat.externalProperties`),
   * which then writes it its own way. False when that plugin did not take
   * it, e.g. because it is not running. Must not reject.
   */
  writeExternalProperty?(
    format: string,
    path: string,
    property: string,
    value: unknown,
  ): Promise<boolean>;
}

/**
 * What became of a write. All but the last come from the format; `failed`
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
  async applyAt(
    path: string,
    origin: NoteReminderOrigin,
    action: NoteReminderAction,
  ): Promise<WriteResult> {
    const fn = (fm: Frontmatter): ApplyOutcome =>
      this.reader.apply(fm, origin, action);
    const taken = await this.offerExternalProperties(path, origin, fn);
    if (taken == null) {
      return this.write(path, fn);
    }
    // The other plugin has written its properties, so the action is half
    // done and `fn` can no longer be applied to the note as it is: it would
    // find its own change and call the reminder stale or missing. What is
    // left is the rest of the change `fn` made, as long as the note holds
    // what was handed over.
    return this.write(path, (fm) => {
      const inPlace = taken.properties.every(
        (p) => JSON.stringify(fm[p]) === JSON.stringify(taken.after[p]),
      );
      if (!inPlace) {
        return fn(fm);
      }
      const keys = new Set([
        ...Object.keys(taken.before),
        ...Object.keys(taken.after),
      ]);
      for (const key of keys) {
        if (taken.properties.includes(key)) {
          continue;
        }
        const value = taken.after[key];
        if (JSON.stringify(value) === JSON.stringify(taken.before[key])) {
          continue;
        }
        if (value === undefined) {
          delete fm[key];
        } else {
          fm[key] = value;
        }
      }
      return "applied";
    });
  }

  /**
   * Hands the properties that belong to another plugin to that plugin, when
   * `fn` changes them. Returns what was handed over when that plugin took
   * all of it: the note before and after `fn`, and the properties taken.
   * Null when nothing was offered or something was not taken; the note is
   * then written as for any format.
   *
   * Nothing here may fail the action.
   */
  private async offerExternalProperties(
    path: string,
    origin: NoteReminderOrigin,
    fn: (fm: Frontmatter) => ApplyOutcome,
  ): Promise<{
    before: Frontmatter;
    after: Frontmatter;
    properties: Array<string>;
  } | null> {
    const properties = this.reader.externalProperties(origin);
    if (this.deps.writeExternalProperty == null || properties.length === 0) {
      return null;
    }
    try {
      const after = await this.readFrontmatter(path);
      const before = JSON.parse(JSON.stringify(after)) as Frontmatter;
      if (fn(after) !== "applied") {
        return null;
      }
      const changed = properties.filter(
        (p) => JSON.stringify(after[p]) !== JSON.stringify(before[p]),
      );
      if (changed.length === 0) {
        return null;
      }
      let taken = true;
      for (const property of changed) {
        taken =
          (await this.deps.writeExternalProperty(
            origin.format,
            path,
            property,
            after[property],
          )) && taken;
      }
      return taken ? { before, after, properties: changed } : null;
    } catch (e) {
      console.debug("Cannot offer a property: path=%s, error=%o", path, e);
      return null;
    }
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
