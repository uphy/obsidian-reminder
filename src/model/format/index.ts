import { Reminder } from "model/reminder";
import { format } from "path";
import { MarkdownDocument } from "./markdown";
import type { ReminderEdit, ReminderFormat } from "./reminder-base";
import { CompositeReminderFormat } from "./reminder-base";
import { RegexpReminderFormat } from "./reminder-default";
import { TasksPluginFormat } from "./reminder-tasks-plugin";

const REMINDER_FORMAT = new CompositeReminderFormat();
REMINDER_FORMAT.resetFormat([RegexpReminderFormat.instance]);

export class ReminderFormatType {
    constructor(public name: string, public description: string, public example: string, public format: ReminderFormat, public defaultEnabled: boolean) { };
}

export type {
    ReminderFormat,
    ReminderEdit,
}

export function parseReminder(file: string, lineIndex: number, line: string): Reminder {
    return REMINDER_FORMAT.parse(file, lineIndex, line);
}

export function modifyReminder(line: string, edit: ReminderEdit): string {
    return REMINDER_FORMAT.modify(line, edit);
}

export function changeReminderFormat(formatTypes: Array<ReminderFormatType>) {
    if (formatTypes.length === 0) {
        REMINDER_FORMAT.resetFormat([RegexpReminderFormat.instance]);
    } else {
        REMINDER_FORMAT.resetFormat(formatTypes.map(f => f.format));
    }
}

export const ReminderFormatTypes = [
    new ReminderFormatType("ReminderPluginReminderFormat", "reminder plugin format", "(@2021-09-08)", RegexpReminderFormat.instance, true),
    new ReminderFormatType("TasksPluginReminderFormat", "tasks plugin format", "📅2021-09-08", TasksPluginFormat.instance, false),
    new ReminderFormatType("KanbanPluginReminderFormat", "Kanban plugin format", "{@2021-09-08}", RegexpReminderFormat.kanban, false),
];

export {
    MarkdownDocument
}