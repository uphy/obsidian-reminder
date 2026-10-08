import { DateTime } from "model/time";
import { moment } from "model/moment";
import { appendReminderToKanbanCardLine } from "./kanban-card";
import { ReminderFormatConfig } from "./reminder-base";
import type { ReminderFormat } from "./reminder-base";
import { DefaultReminderFormat } from "./reminder-default";
import { TasksPluginFormat } from "./reminder-tasks-plugin";

describe("appendReminderToKanbanCardLine()", (): void => {
  const time = new DateTime(moment("2021-09-14 10:00"), true);

  const formats: Array<[string, () => ReminderFormat]> = [
    ["default format", () => new DefaultReminderFormat()],
    ["tasks plugin format", () => new TasksPluginFormat()],
  ];

  describe.each(formats)("%s", (_name, newFormat): void => {
    function format(): ReminderFormat {
      const f = newFormat();
      f.setConfig(new ReminderFormatConfig());
      return f;
    }

    test("same result as on a task line, minus the checkbox", (): void => {
      const onTaskLine = format().appendReminder("- [ ] test", time)!;
      const inserted = appendReminderToKanbanCardLine(format(), "test", time);
      expect(inserted).toEqual({
        insertedLine: onTaskLine.insertedLine.substring("- [ ] ".length),
        caretPosition: onTaskLine.caretPosition - "- [ ] ".length,
      });
      expect(inserted!.insertedLine).not.toContain("[ ]");
    });

    test("insertAt is a position in the card text", (): void => {
      const onTaskLine = format().appendReminder(
        "- [ ] foo bar",
        time,
        "- [ ] foo ".length,
      )!;
      const inserted = appendReminderToKanbanCardLine(
        format(),
        "foo bar",
        time,
        "foo ".length,
      );
      expect(inserted).toEqual({
        insertedLine: onTaskLine.insertedLine.substring("- [ ] ".length),
        caretPosition: onTaskLine.caretPosition - "- [ ] ".length,
      });
    });
  });

  test("default format output", (): void => {
    const f = new DefaultReminderFormat();
    f.setConfig(new ReminderFormatConfig());
    expect(appendReminderToKanbanCardLine(f, "test", time)!.insertedLine).toBe(
      "test(@2021-09-14 10:00)",
    );
  });

  test("returns null when the format cannot append a reminder", (): void => {
    const f = {
      appendReminder: () => null,
    } as unknown as ReminderFormat;
    expect(appendReminderToKanbanCardLine(f, "test", time)).toBeNull();
  });
});
