import type { TaskNotesDoneBehavior } from "./index";

export interface TaskNotesCompletionActions {
  behavior: TaskNotesDoneBehavior;
  openTaskEditModal: () => Promise<boolean>;
  notifyModalUnavailable: () => void;
  openTaskNote: () => Promise<void>;
  writeCompletedStatus: () => Promise<void>;
  markReminderDone: () => void;
}

export async function completeTaskNotesReminder(
  actions: TaskNotesCompletionActions,
): Promise<void> {
  if (actions.behavior === "write-completed-status") {
    await actions.writeCompletedStatus();
  } else if (!(await actions.openTaskEditModal())) {
    actions.notifyModalUnavailable();
    await actions.openTaskNote();
  }
  actions.markReminderDone();
}
