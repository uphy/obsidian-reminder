/** Named on every write, so TaskNotes' events say where it came from. */
const SOURCE = "obsidian-reminder";

/**
 * The one place that knows how to call the running TaskNotes plugin.
 *
 * TaskNotes publishes a versioned runtime API on `api` of its plugin
 * instance and asks other plugins to change task data through it rather than
 * by rewriting frontmatter, so that its cache, events and views follow. The
 * formats in `model/note/` know TaskNotes' data, not this API: they say what
 * a note should hold, and this class is one of the ways it gets there.
 *
 * Nothing here is required to work. Every method answers "not available"
 * (undefined / false) when TaskNotes is not running, has no such API, has
 * another API version, lacks the capability, or throws; the callers then
 * read and write the note themselves.
 */
export class TaskNotesApi {
  /**
   * @param plugin The TaskNotes plugin instance now, `undefined` when it is
   *   not enabled. Asked on every call: TaskNotes can load after this
   *   plugin and be turned off at any time.
   */
  constructor(private plugin: () => unknown) {}

  /**
   * TaskNotes' settings, unchecked (`importTaskNotesSettings` checks them).
   * `settings.snapshot()` of the API is preferred; a TaskNotes without it is
   * read through the `settings` field of the plugin instance, which holds
   * the same object. Undefined when there are none.
   */
  settings(): unknown {
    const plugin = this.plugin();
    if (!isRecord(plugin)) {
      return undefined;
    }
    try {
      const settings = this.namespace("settings", "settings.snapshot");
      if (settings != null && typeof settings["snapshot"] === "function") {
        const snapshot: unknown = settings["snapshot"].call(settings);
        // An asynchronous snapshot can't be used here; the field below can.
        if (isRecord(snapshot) && !(snapshot instanceof Promise)) {
          return snapshot;
        }
      }
    } catch (e) {
      console.warn("Failed to read TaskNotes' settings through its API: %o", e);
    }
    return plugin["settings"];
  }

  /**
   * Replaces the reminders of the task note at `path`. False when TaskNotes
   * did not take the write, e.g. because it does not see the note as a task.
   */
  async setReminders(path: string, reminders: unknown): Promise<boolean> {
    if (!Array.isArray(reminders)) {
      return false;
    }
    try {
      const tasks = this.namespace("tasks", "tasks.write");
      if (tasks == null || typeof tasks["setReminders"] !== "function") {
        return false;
      }
      await tasks["setReminders"].call(tasks, path, reminders, {
        source: SOURCE,
      });
      return true;
    } catch (e) {
      console.warn(
        "TaskNotes did not take the reminders: path=%s, error=%o",
        path,
        e,
      );
      return false;
    }
  }

  /** A namespace of API version 1, when it has `capability`. */
  private namespace(
    name: string,
    capability: string,
  ): Record<string, unknown> | null {
    const plugin = this.plugin();
    const api = isRecord(plugin) ? plugin["api"] : undefined;
    if (!isRecord(api) || api["apiVersion"] !== 1) {
      return null;
    }
    const hasCapability = api["hasCapability"];
    if (
      typeof hasCapability !== "function" ||
      hasCapability.call(api, capability) !== true
    ) {
      return null;
    }
    const namespace = api[name];
    return isRecord(namespace) ? namespace : null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
