import type { Reminder } from "model/reminder";

/**
 * A reminder's time text located at an absolute `[from, to)` position within
 * a CodeMirror 6 document, along with the reminder it belongs to and the
 * text it covers (used as the pill's label).
 */
export interface ReminderPillSpan {
  from: number;
  to: number;
  reminder: Reminder;
  text: string;
}
