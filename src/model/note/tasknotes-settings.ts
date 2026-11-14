import { DEFAULT_TASKNOTES_PROPERTIES } from "./tasknotes-format";
import type {
  TaskNotesIdentification,
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
