import { completeTaskNotesReminder } from "./completion";

describe("completeTaskNotesReminder()", (): void => {
  test("opens TaskNotes edit modal without writing YAML", async (): Promise<void> => {
    const openTaskEditModal = jest.fn(async () => true);
    const writeCompletedStatus = jest.fn(async () => {});
    const markReminderDone = jest.fn();

    await completeTaskNotesReminder({
      behavior: "open-task-modal",
      openTaskEditModal,
      notifyModalUnavailable: jest.fn(),
      openTaskNote: jest.fn(async () => {}),
      writeCompletedStatus,
      markReminderDone,
    });

    expect(openTaskEditModal).toHaveBeenCalledTimes(1);
    expect(writeCompletedStatus).not.toHaveBeenCalled();
    expect(markReminderDone).toHaveBeenCalledTimes(1);
  });

  test("falls back to opening the task note when the modal is unavailable", async (): Promise<void> => {
    const notifyModalUnavailable = jest.fn();
    const openTaskNote = jest.fn(async () => {});
    const markReminderDone = jest.fn();

    await completeTaskNotesReminder({
      behavior: "open-task-modal",
      openTaskEditModal: async () => false,
      notifyModalUnavailable,
      openTaskNote,
      writeCompletedStatus: async () => {},
      markReminderDone,
    });

    expect(notifyModalUnavailable).toHaveBeenCalledTimes(1);
    expect(openTaskNote).toHaveBeenCalledTimes(1);
    expect(markReminderDone).toHaveBeenCalledTimes(1);
  });

  test("writes status before marking the reminder done", async (): Promise<void> => {
    const order: Array<string> = [];

    await completeTaskNotesReminder({
      behavior: "write-completed-status",
      openTaskEditModal: async () => false,
      notifyModalUnavailable: () => order.push("notice"),
      openTaskNote: async () => {
        order.push("open-note");
      },
      writeCompletedStatus: async () => {
        order.push("write-status");
      },
      markReminderDone: () => order.push("mark-done"),
    });

    expect(order).toEqual(["write-status", "mark-done"]);
  });

  test("does not mark the reminder done when writing the status fails", async (): Promise<void> => {
    const markReminderDone = jest.fn();

    await expect(
      completeTaskNotesReminder({
        behavior: "write-completed-status",
        openTaskEditModal: async () => false,
        notifyModalUnavailable: jest.fn(),
        openTaskNote: async () => {},
        writeCompletedStatus: async () => {
          throw new Error("write failed");
        },
        markReminderDone,
      }),
    ).rejects.toThrow("write failed");

    expect(markReminderDone).not.toHaveBeenCalled();
  });
});
