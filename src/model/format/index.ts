import { Reminder } from "model/reminder";
import { MarkdownDocument } from "./markdown";
import type { ReminderEdit, ReminderFormat } from "./reminder-base";
import { CompositeReminderFormat } from "./reminder-base";
import { DefaultReminderFormat } from "./reminder-default";
import { KanbanReminderFormat } from "./reminder-kanban-plugin";
import { TasksPluginFormat } from "./reminder-tasks-plugin";

const REMINDER_FORMAT = new CompositeReminderFormat();
REMINDER_FORMAT.resetFormat([DefaultReminderFormat.instance]);

export class ReminderFormatType {
    constructor(public name: string, public description: string, public example: string, public format: ReminderFormat, public defaultEnabled: boolean) { };
}

export type {
    ReminderFormat,
    ReminderEdit,
}

export function parseReminder(doc: MarkdownDocument): Array<Reminder> {
    return REMINDER_FORMAT.parse(doc);
}

export async function modifyReminder(doc: MarkdownDocument, reminder: Reminder, edit: ReminderEdit): Promise<boolean> {
    return REMINDER_FORMAT.modify(doc, reminder, edit);
}

export function changeReminderFormat(formatTypes: Array<ReminderFormatType>) {
    if (formatTypes.length === 0) {
        REMINDER_FORMAT.resetFormat([DefaultReminderFormat.instance]);
    } else {
        REMINDER_FORMAT.resetFormat(formatTypes.map(f => f.format));
    }
}

export const ReminderFormatTypes = [
    new ReminderFormatType("ReminderPluginReminderFormat", "reminder plugin format", "(@2021-09-08)", DefaultReminderFormat.instance, true),
    new ReminderFormatType("TasksPluginReminderFormat", "tasks plugin format", "📅2021-09-08", TasksPluginFormat.instance, false),
    new ReminderFormatType("KanbanPluginReminderFormat", "Kanban plugin format", "@{2021-09-08}", KanbanReminderFormat.instance, false),
];

export {
    MarkdownDocument
}