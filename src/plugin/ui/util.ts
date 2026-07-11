import type Electron from "electron";
import { Notice } from "obsidian";

const electron = window.require ? window.require("electron") : undefined;

export function showReminderInsertionFailureNotice() {
  new Notice(
    'Cannot insert a reminder here.  Reminders can only be added to task lines such as "- [ ] Task".',
  );
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
