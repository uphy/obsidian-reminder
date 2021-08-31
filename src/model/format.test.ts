import { TasksPluginFormat } from "./format";

describe('TasksPluginFormat', (): void => {

    test('parseReminderLine()', (): void => {
        // normal
        {
            const line = TasksPluginFormat.parseReminderLine("- [ ] this is a title 🔁every hour📅2021-09-08 ✅2021-08-31");
            expect(line.doneDate).toBe("2021-08-31");
            expect(line.dueDate).toBe("2021-09-08");
            expect(line.recurrence).toBe("every hour");
            expect(line.prefix).toBe("");
            expect(line.title).toBe("this is a title");
            expect(line.toLine()).toBe("- [ ] this is a title 🔁every hour 📅2021-09-08 ✅2021-08-31");
        }
        // with space
        {
            const line = TasksPluginFormat.parseReminderLine("- [ ] this is a title 🔁 every hour 📅 2021-09-08 ✅ 2021-08-31");
            expect(line.doneDate).toBe("2021-08-31");
            expect(line.dueDate).toBe("2021-09-08");
            expect(line.recurrence).toBe("every hour");
            expect(line.prefix).toBe("");
            expect(line.title).toBe("this is a title");
            expect(line.toLine()).toBe("- [ ] this is a title 🔁every hour 📅2021-09-08 ✅2021-08-31");
        }
    });
})