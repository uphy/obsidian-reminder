import { completeTaskNotesReminder } from "./completion";

describe("completeTaskNotesReminder()", (): void => {
  test("opens TaskNotes edit modal without writing YAML", async (): Promise<void> => {
    const openTaskEditModal = jest.fn(async () => true);
    const markReminderDone = jest.fn();

    await completeTaskNotesReminder({
      openTaskEditModal,
      notifyModalUnavailable: jest.fn(),
      openTaskNote: jest.fn(async () => {}),
      markReminderDone,
    });

    expect(openTaskEditModal).toHaveBeenCalledTimes(1);
    expect(markReminderDone).toHaveBeenCalledTimes(1);
  });

  test("falls back to opening the task note when the modal is unavailable", async (): Promise<void> => {
    const notifyModalUnavailable = jest.fn();
    const openTaskNote = jest.fn(async () => {});
    const markReminderDone = jest.fn();

    await completeTaskNotesReminder({
      openTaskEditModal: async () => false,
      notifyModalUnavailable,
      openTaskNote,
      markReminderDone,
    });

    expect(notifyModalUnavailable).toHaveBeenCalledTimes(1);
    expect(openTaskNote).toHaveBeenCalledTimes(1);
    expect(markReminderDone).toHaveBeenCalledTimes(1);
  });
});
