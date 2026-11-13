import type { DateTime } from "model/time";

export type TaskNotesIdentificationMode = "tag" | "property" | "reminders";

export interface TaskNotesPropertyNames {
  title: string;
  status: string;
  due: string;
  scheduled: string;
  reminders: string;
  completedDate: string;
  recurrence: string;
  completeInstances: string;
  skippedInstances: string;
}

export interface TaskNotesOptions {
  identificationMode: TaskNotesIdentificationMode;
  tag: string;
  identificationProperty: string;
  identificationValue: string;
  excludedFolders: Array<string>;
  properties: TaskNotesPropertyNames;
  completedStatuses: Array<string>;
  skipCompleted: boolean;
  skipArchived: boolean;
  archiveTag: string;
  skipRecurringInstances: boolean;
  dateOnlyAnchorTime: string;
  ignoreOlderThanDays: number;
}

export interface TaskNotesContext {
  filePath: string;
  fileName: string;
  tags: Array<string>;
  options: TaskNotesOptions;
  now?: DateTime;
  effectiveTimeFor?: (reminderId: string, trigger: DateTime) => DateTime;
  warnOnce?: (key: string, message: string) => void;
}

export const DEFAULT_TASKNOTES_PROPERTIES: TaskNotesPropertyNames = {
  title: "title",
  status: "status",
  due: "due",
  scheduled: "scheduled",
  reminders: "reminders",
  completedDate: "completedDate",
  recurrence: "recurrence",
  completeInstances: "complete_instances",
  skippedInstances: "skipped_instances",
};
