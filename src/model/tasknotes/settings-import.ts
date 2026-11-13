import type {
  TaskNotesIdentificationMode,
  TaskNotesPropertyNames,
} from "./types";

export interface ImportedTaskNotesSettings {
  identificationMode: TaskNotesIdentificationMode;
  tag: string;
  identificationProperty: string;
  identificationValue: string;
  excludedFolders: string;
  completedStatuses: string;
  archiveTag: string;
  properties: TaskNotesPropertyNames;
}

const PROPERTY_MAPPING: Record<keyof TaskNotesPropertyNames, string> = {
  title: "title",
  status: "status",
  due: "due",
  scheduled: "scheduled",
  reminders: "reminders",
  completedDate: "completedDate",
  recurrence: "recurrence",
  completeInstances: "completeInstances",
  skippedInstances: "skippedInstances",
};

export function importTaskNotesSettings(
  value: unknown,
): ImportedTaskNotesSettings {
  if (!isRecord(value)) {
    throw new Error("TaskNotes settings are unavailable.");
  }
  const fieldMapping = requireRecord(value["fieldMapping"], "fieldMapping");
  const properties: TaskNotesPropertyNames = {
    title: getMappedProperty(fieldMapping, "title"),
    status: getMappedProperty(fieldMapping, "status"),
    due: getMappedProperty(fieldMapping, "due"),
    scheduled: getMappedProperty(fieldMapping, "scheduled"),
    reminders: getMappedProperty(fieldMapping, "reminders"),
    completedDate: getMappedProperty(fieldMapping, "completedDate"),
    recurrence: getMappedProperty(fieldMapping, "recurrence"),
    completeInstances: getMappedProperty(fieldMapping, "completeInstances"),
    skippedInstances: getMappedProperty(fieldMapping, "skippedInstances"),
  };

  const identificationMode = value["taskIdentificationMethod"];
  if (identificationMode !== "tag" && identificationMode !== "property") {
    throw new Error(
      "TaskNotes task identification must be set to tag or property.",
    );
  }

  const statuses = value["customStatuses"];
  if (!Array.isArray(statuses)) {
    throw new Error("TaskNotes custom statuses are unavailable.");
  }
  const completedStatuses = statuses
    .map((status) => {
      if (!isRecord(status) || typeof status["isCompleted"] !== "boolean") {
        throw new Error("TaskNotes custom status settings are invalid.");
      }
      if (typeof status["value"] !== "string") {
        throw new Error("A TaskNotes custom status is missing its value.");
      }
      return status["isCompleted"] ? status["value"].trim() : undefined;
    })
    .filter((status): status is string => status !== undefined);
  if (completedStatuses.some((status) => !status)) {
    throw new Error("A completed TaskNotes status must have a value.");
  }

  return {
    identificationMode,
    tag: requireString(value["taskTag"], "taskTag"),
    identificationProperty: requireString(
      value["taskPropertyName"],
      "taskPropertyName",
    ),
    identificationValue: requireString(
      value["taskPropertyValue"],
      "taskPropertyValue",
    ),
    excludedFolders: requireString(value["excludedFolders"], "excludedFolders")
      .split(",")
      .map((folder) => folder.trim())
      .filter((folder) => folder.length > 0)
      .join("\n"),
    completedStatuses: completedStatuses.join("\n"),
    archiveTag: requireString(fieldMapping["archiveTag"], "archiveTag"),
    properties,
  };
}

export function importTaskNotesRuntimeSettings(
  snapshot: unknown,
  statuses: unknown,
): ImportedTaskNotesSettings {
  if (!isRecord(snapshot)) {
    throw new Error("TaskNotes settings snapshot is unavailable.");
  }
  if (!Array.isArray(statuses)) {
    throw new Error("TaskNotes status catalog is unavailable.");
  }
  return importTaskNotesSettings({
    ...snapshot,
    customStatuses: statuses,
  });
}

function getMappedProperty(
  fieldMapping: Record<string, unknown>,
  key: keyof TaskNotesPropertyNames,
): string {
  const taskNotesKey = PROPERTY_MAPPING[key];
  const propertyName = requireString(fieldMapping[taskNotesKey], taskNotesKey);
  if (!propertyName.trim()) {
    throw new Error(
      `TaskNotes field mapping "${taskNotesKey}" must not be empty.`,
    );
  }
  return propertyName;
}

function requireRecord(value: unknown, name: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error(`TaskNotes ${name} settings are unavailable.`);
  }
  return value;
}

function requireString(value: unknown, name: string): string {
  if (typeof value !== "string") {
    throw new Error(`TaskNotes ${name} setting is invalid.`);
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
