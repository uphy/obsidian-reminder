import { TasksPluginReminderLine } from "model/format/reminder-tasks-plugin";
import { DateTime } from "model/time";
import moment from "moment";

describe('TasksPluginReminderLine', (): void => {
    test('parse()', (): void => {
        const parsed = TasksPluginReminderLine.parse("this is a title 🔁 every hour 📅 2021-09-08 ✅ 2021-08-31");
        expect(parsed.getDescription()).toBe("this is a title");
        expect(parsed.getDueDate().toString()).toBe("2021-09-08");
        expect(parsed.getDoneDate().toString()).toBe("2021-08-31");
    });
    test('setDescription()', (): void => {
        const parsed = TasksPluginReminderLine.parse("this is a title 🔁 every hour 📅 2021-09-08 ✅ 2021-08-31");
        parsed.setDescription("ABC");
        expect(parsed.getDescription()).toBe("ABC");
        expect(parsed.toLine()).toBe("ABC 🔁 every hour 📅 2021-09-08 ✅ 2021-08-31");
    });
    test('setDueDate() - date', (): void => {
        const parsed = TasksPluginReminderLine.parse("this is a title 🔁 every hour 📅 2021-09-08 ✅ 2021-08-31");
        parsed.setDueDate(new DateTime(moment("2021-09-09"), false));
        expect(parsed.getDueDate().toString()).toBe("2021-09-09");
        expect(parsed.toLine()).toBe("this is a title 🔁 every hour 📅 2021-09-09 ✅ 2021-08-31");
    });
    test('setDueDate() - string', (): void => {
        const parsed = TasksPluginReminderLine.parse("this is a title 🔁 every hour 📅 2021-09-08 ✅ 2021-08-31");
        parsed.setDueDate("XXX");
        expect(parsed.getDueDate()).toBe(null);
        expect(parsed.toLine()).toBe("this is a title 🔁 every hour 📅 XXX ✅ 2021-08-31");
    });
    test('setDueDate() - append - with space', (): void => {
        const parsed = TasksPluginReminderLine.parse("this is a title 🔁 every hour ✅ 2021-08-31");
        parsed.setDueDate(new DateTime(moment("2021-09-08"), false));
        expect(parsed.getDueDate().toString()).toBe("2021-09-08");
        expect(parsed.toLine()).toBe("this is a title 🔁 every hour ✅ 2021-08-31 📅 2021-09-08");
    });
    test('setDueDate() - append - without space', (): void => {
        const parsed = TasksPluginReminderLine.parse("this is a title 🔁every hour ✅2021-08-31");
        parsed.setDueDate(new DateTime(moment("2021-09-08"), false));
        expect(parsed.getDueDate().toString()).toBe("2021-09-08");
        expect(parsed.toLine()).toBe("this is a title 🔁every hour ✅2021-08-31 📅2021-09-08");
    });
    test('setDueDate() - append - no advice', (): void => {
        const parsed = TasksPluginReminderLine.parse("this is a title");
        parsed.setDueDate(new DateTime(moment("2021-09-08"), false));
        expect(parsed.getDueDate().toString()).toBe("2021-09-08");
        expect(parsed.toLine()).toBe("this is a title 📅 2021-09-08");
    });
});
