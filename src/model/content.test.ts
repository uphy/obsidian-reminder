import { Content } from "./content";
import { Reminder } from "./reminder";
import { DateTime } from "./time";

describe("Content", (): void => {
  test("refuses to write a TaskNotes reminder", async (): Promise<void> => {
    const markdown = "---\nreminders: []\n---\n";
    const content = new Content("Tasks/Task.md", markdown);
    const reminder = new Reminder(
      "Tasks/Task.md",
      "TaskNotes reminder",
      DateTime.parse("2026-11-20 09:00"),
      -1,
      false,
      "tasknotes",
      {
        reminderId: "read-only",
        anchor: { type: "due", time: DateTime.parse("2026-11-20 09:00") },
        taskTitle: "Task",
      },
    );

    await expect(
      content.updateReminder(reminder, { time: reminder.time }),
    ).rejects.toThrow("TaskNotes reminders are read-only.");
    expect(content.getContent()).toBe(markdown);
  });
});
