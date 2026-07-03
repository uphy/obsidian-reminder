import type { Reminder } from "model/reminder";
import { MarkdownDocument } from "./markdown";
import type {
  ReminderEdit,
  ReminderFormat,
  ReminderFormatConfig,
} from "./reminder-base";
import { CompositeReminderFormat, ReminderFormatParameterKey } from "./reminder-base";
import { DefaultReminderFormat } from "./reminder-default";
import { KanbanReminderFormat } from "./reminder-kanban-plugin";
import { TasksPluginFormat } from "./reminder-tasks-plugin";

const REMINDER_FORMAT = new CompositeReminderFormat();
REMINDER_FORMAT.resetFormat([DefaultReminderFormat.instance]);

export class ReminderFormatType {
  constructor(
    public name: string,
    public description: string,
    public example: string,
    public format: ReminderFormat,
    public defaultEnabled: boolean,
  ) {}
}

export type { ReminderFormat, ReminderEdit };

export function parseReminder(doc: MarkdownDocument): Array<Reminder> {
  return REMINDER_FORMAT.parse(doc);
}

export async function modifyReminder(
  doc: MarkdownDocument,
  reminder: Reminder,
  edit: ReminderEdit,
): Promise<boolean> {
  return REMINDER_FORMAT.modify(doc, reminder, edit);
}

export function changeReminderFormat(formatTypes: Array<ReminderFormatType>) {
  if (formatTypes.length === 0) {
    REMINDER_FORMAT.resetFormat([DefaultReminderFormat.instance]);
  } else {
    REMINDER_FORMAT.resetFormat(formatTypes.map((f) => f.format));
  }
}

export function setReminderFormatConfig(config: ReminderFormatConfig) {
  REMINDER_FORMAT.setConfig(config);
  // 同时直接给所有已知 format 实例设置 config
  // 因为 editor-extension.ts 会直接使用 primaryFormat.value.format（绕过 REMINDER_FORMAT）
  // 若该 format 未被加入 REMINDER_FORMAT.formats，则不会通过 syncConfig 收到 config
  DefaultReminderFormat.instance.setConfig(config);
  TasksPluginFormat.instance.setConfig(config);
  KanbanReminderFormat.instance.setConfig(config);
}

export const reminderPluginReminderFormat = new ReminderFormatType(
  "ReminderPluginReminderFormat",
  "Reminder plugin format",
  "(@2021-09-08)",
  DefaultReminderFormat.instance,
  true,
);
export const tasksPluginReminderFormat = new ReminderFormatType(
  "TasksPluginReminderFormat",
  "Tasks plugin format",
  "📅 2021-09-08",
  TasksPluginFormat.instance,
  false,
);
export const kanbanPluginReminderFormat = new ReminderFormatType(
  "KanbanPluginReminderFormat",
  "Kanban plugin format",
  "@{2021-09-08}",
  KanbanReminderFormat.instance,
  false,
);

export const ReminderFormatTypes = [
  reminderPluginReminderFormat,
  tasksPluginReminderFormat,
  kanbanPluginReminderFormat,
];

export { MarkdownDocument };
