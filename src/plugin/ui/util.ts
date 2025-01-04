import type Electron from 'electron';

const electron = require('electron');

export enum OkCancel {
  OK,
  CANCEL,
}
export async function showOkCancelDialog(title: string, message: string): Promise<OkCancel> {
  if (!electron) {
    return OkCancel.CANCEL;
  }
  const selected: Electron.MessageBoxReturnValue = await (electron as any).remote.dialog.showMessageBox({
    type: 'question',
    title: 'Obsidian Reminder',
    message: title,
    detail: message,
    buttons: ['OK', 'Cancel'],
    cancelId: 1,
  });
  if (selected.response === 0) {
    return OkCancel.OK;
  }
  return OkCancel.CANCEL;
}
