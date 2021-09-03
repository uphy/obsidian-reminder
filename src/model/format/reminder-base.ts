import { Reminder } from "model/reminder"
import { DateTime } from "model/time"

export type ReminderEdit = {
    time?: DateTime,
    rawTime?: string
}

export interface ReminderFormat {
    /**
     * Parse given line if possible.
     * 
     * @param file file path
     * @param lineIndex line index
     * @param line line to parse
     * @returns parsed reminder.  If the line cannot be parsed, returns null
     */
    parse(file: string, lineIndex: number, line: string): Reminder | null
    /**
     * Modify the given line if possible.
     * 
     * @param line line to parse
     * @param edit defines how to edit
     * @returns modified line.  If the line cannot be parsed, returns null
     */
    modify(line: string, edit: ReminderEdit): string | null;
}



export class CompositeReminderFormat implements ReminderFormat {
    private formats: Array<ReminderFormat> = [];

    resetFormat(formats: Array<ReminderFormat>) {
        this.formats = formats;
    }

    parse(file: string, lineIndex: number, line: string): Reminder | null {
        for (const formatter of this.formats) {
            const parsed = formatter.parse(file, lineIndex, line);
            if (parsed !== null) {
                return parsed;
            }
        }
        return null;
    }
    modify(line: string, edit: ReminderEdit): string | null {
        for (const formatter of this.formats) {
            const modified = formatter.modify(line, edit);
            if (modified !== null) {
                return modified;
            }
        }
        return null;
    }
}
