export interface TaskNotesCompletionActions {
  openTaskEditModal: () => Promise<boolean>;
  notifyModalUnavailable: () => void;
  openTaskNote: () => Promise<void>;
  markReminderDone: () => void;
}

export async function completeTaskNotesReminder(
  actions: TaskNotesCompletionActions,
): Promise<void> {
  if (!(await actions.openTaskEditModal())) {
    actions.notifyModalUnavailable();
    await actions.openTaskNote();
  }
  actions.markReminderDone();
}
