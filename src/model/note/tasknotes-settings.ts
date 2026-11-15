import { DEFAULT_TASKNOTES_PROPERTIES } from "./tasknotes-format";
import type {
  TaskNotesIdentification,
  TaskNotesOptions,
  TaskNotesProperties,
} from "./tasknotes-format";

/** What this plugin takes over from the TaskNotes plugin's own settings. */
export type ImportedTaskNotesSettings = {
  identification: TaskNotesIdentification;
  taskTag: string;
  taskProperty: string;
  taskPropertyValue: string;
  completedStatuses: Array<string>;
  archiveTag: string;
  properties: TaskNotesProperties;
};

/** The values TaskNotes starts with. */
export const DEFAULT_TASKNOTES_SETTINGS: ImportedTaskNotesSettings = {
  identification: "tag",
  taskTag: "task",
  taskProperty: "",
  taskPropertyValue: "",
  completedStatuses: ["done"],
  archiveTag: "archived",
  properties: DEFAULT_TASKNOTES_PROPERTIES,
};

/**
 * Reads the settings object of the TaskNotes plugin (its `data.json`, as the
 * running plugin holds it). Null when `raw` is not an object at all, which
 * means TaskNotes is not installed or not enabled.
 *
 * That object is not an API, so nothing in it is trusted: a value that is
 * missing or of another type than expected leaves TaskNotes' default in
 * place, and a later TaskNotes that renames a key degrades to the defaults
 * instead of breaking the reading.
 */
export function importTaskNotesSettings(
  raw: unknown,
): ImportedTaskNotesSettings | null {
  if (!isRecord(raw)) {
    return null;
  }
  const defaults = DEFAULT_TASKNOTES_SETTINGS;
  const mapping = isRecord(raw["fieldMapping"]) ? raw["fieldMapping"] : {};
  const properties = { ...defaults.properties };
  for (const key of Object.keys(properties) as Array<
    keyof TaskNotesProperties
  >) {
    properties[key] = text(mapping[key], properties[key]);
  }
  return {
    identification:
      raw["taskIdentificationMethod"] === "property" ? "property" : "tag",
    taskTag: text(raw["taskTag"], defaults.taskTag).replace(/^#/, ""),
    // Empty is meaningful for these two: no property, any value.
    taskProperty:
      typeof raw["taskPropertyName"] === "string"
        ? raw["taskPropertyName"].trim()
        : "",
    taskPropertyValue:
      typeof raw["taskPropertyValue"] === "string"
        ? raw["taskPropertyValue"].trim()
        : "",
    completedStatuses: completedStatusesOf(raw["customStatuses"]),
    archiveTag: text(mapping["archiveTag"], defaults.archiveTag).replace(
      /^#/,
      "",
    ),
    properties,
  };
}

/** The `value` of every status TaskNotes marks as completed. */
function completedStatusesOf(statuses: unknown): Array<string> {
  if (!Array.isArray(statuses)) {
    return DEFAULT_TASKNOTES_SETTINGS.completedStatuses;
  }
  const completed: Array<string> = [];
  for (const status of statuses) {
    if (!isRecord(status) || status["isCompleted"] !== true) {
      continue;
    }
    const value = text(status["value"], "");
    if (value !== "" && !completed.includes(value)) {
      completed.push(value);
    }
  }
  return completed;
}

function text(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() !== ""
    ? value.trim()
    : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * `settings` in the shape `importTaskNotesSettings` reads, i.e. the part of
 * TaskNotes' own settings this plugin uses. It is what gets saved as "the
 * TaskNotes settings last seen", so that reading it back goes through the
 * same checks as reading TaskNotes itself.
 */
export function exportTaskNotesSettings(
  settings: ImportedTaskNotesSettings,
): Record<string, unknown> {
  return {
    taskIdentificationMethod: settings.identification,
    taskTag: settings.taskTag,
    taskPropertyName: settings.taskProperty,
    taskPropertyValue: settings.taskPropertyValue,
    fieldMapping: { ...settings.properties, archiveTag: settings.archiveTag },
    customStatuses: settings.completedStatuses.map((value) => ({
      value,
      isCompleted: true,
    })),
  };
}

/** Where the defaults of the TaskNotes settings come from. */
export type TaskNotesDefaultsSource =
  /** The running TaskNotes plugin. */
  | "tasknotes"
  /** What TaskNotes said the last time it was there. */
  | "saved"
  /** TaskNotes' factory defaults: it was never seen. */
  | "builtin";

/**
 * The defaults of the TaskNotes settings, by the first source that has
 * them: the running TaskNotes plugin (`live`, its settings object), what
 * was saved the last time it was there (`saved`, as written by
 * `exportTaskNotesSettings`), and TaskNotes' factory defaults.
 */
export function taskNotesDefaults(
  live: unknown,
  saved: unknown,
): { settings: ImportedTaskNotesSettings; source: TaskNotesDefaultsSource } {
  const fromLive = importTaskNotesSettings(live);
  if (fromLive != null) {
    return { settings: fromLive, source: "tasknotes" };
  }
  const fromSaved = importTaskNotesSettings(saved);
  if (fromSaved != null) {
    return { settings: fromSaved, source: "saved" };
  }
  return { settings: DEFAULT_TASKNOTES_SETTINGS, source: "builtin" };
}

/** What the user set in this plugin; an empty value means "the default". */
export type TaskNotesOverrides = {
  /** "auto" takes the method and its tag / property from the defaults. */
  identification: "auto" | TaskNotesIdentification;
  taskTag: string;
  taskProperty: string;
  taskPropertyValue: string;
  completedStatuses: Array<string>;
  archiveTag: string;
  properties: Partial<TaskNotesProperties>;
};

/**
 * The settings in effect: each value the user set, and the default for
 * every value left empty.
 *
 * How a task is identified is one decision: with "auto" the method, the tag
 * and the property all come from the defaults. With a method chosen here,
 * the tag and the property name fall back to the defaults when empty, but
 * the property value is taken as it is, because an empty value has a
 * meaning of its own (any note that has the property).
 */
export function resolveTaskNotesSettings(
  overrides: TaskNotesOverrides,
  defaults: ImportedTaskNotesSettings,
): Omit<TaskNotesOptions, "enabled" | "since"> {
  const or = (value: string | undefined, fallback: string) =>
    value != null && value.trim() !== "" ? value.trim() : fallback;
  const properties = { ...defaults.properties };
  for (const key of Object.keys(properties) as Array<
    keyof TaskNotesProperties
  >) {
    properties[key] = or(overrides.properties[key], properties[key]);
  }
  const auto = overrides.identification === "auto";
  return {
    identification:
      overrides.identification === "auto"
        ? defaults.identification
        : overrides.identification,
    taskTag: auto ? defaults.taskTag : or(overrides.taskTag, defaults.taskTag),
    taskProperty: auto
      ? defaults.taskProperty
      : or(overrides.taskProperty, defaults.taskProperty),
    taskPropertyValue: auto
      ? defaults.taskPropertyValue
      : overrides.taskPropertyValue.trim(),
    completedStatuses:
      overrides.completedStatuses.length > 0
        ? overrides.completedStatuses
        : defaults.completedStatuses,
    archiveTag: or(overrides.archiveTag, defaults.archiveTag),
    properties,
  };
}
