import type Electron from "electron";
import { convertToTodoLine } from "model/format/markdown";
import type {
  ReminderFormat,
  ReminderInsertion,
} from "model/format/reminder-base";
import type { DateTime } from "model/time";
import { Notice } from "obsidian";

const electron = window.require ? window.require("electron") : undefined;

export function showReminderInsertionFailureNotice() {
  new Notice(
    'Cannot insert a reminder here.  Reminders can only be added to task lines such as "- [ ] Task".',
  );
}

/**
 * Appends a reminder to `line`, converting it into a task list item first
 * when it isn't one and `convertNonTaskLines` is enabled.
 *
 * `insertAt` (if given) is a string index into `line`.  Since converting a
 * line only ever prepends/replaces characters before the original content
 * (never after), the same position in the converted line is shifted by the
 * change in length.
 */
export function appendReminderOrConvert(
  format: ReminderFormat,
  line: string,
  time: DateTime,
  insertAt: number | undefined,
  convertNonTaskLines: boolean,
): ReminderInsertion | null {
  const direct = format.appendReminder(line, time, insertAt);
  if (direct != null) {
    return direct;
  }
  if (!convertNonTaskLines) {
    return null;
  }
  const converted = convertToTodoLine(line);
  if (converted == null) {
    return null;
  }
  const shiftedInsertAt =
    insertAt == null ? undefined : insertAt + (converted.length - line.length);
  return format.appendReminder(converted, time, shiftedInsertAt);
}

export enum OkCancel {
  OK,
  CANCEL,
}
export async function showOkCancelDialog(
  title: string,
  message: string,
): Promise<OkCancel> {
  if (!electron) {
    return OkCancel.CANCEL;
  }
  const selected: Electron.MessageBoxReturnValue = await (
    electron as any
  ).remote.dialog.showMessageBox({
    type: "question",
    title: "Obsidian Reminder",
    message: title,
    detail: message,
    buttons: ["OK", "Cancel"],
    cancelId: 1,
  });
  if (selected.response === 0) {
    return OkCancel.OK;
  }
  return OkCancel.CANCEL;
}
