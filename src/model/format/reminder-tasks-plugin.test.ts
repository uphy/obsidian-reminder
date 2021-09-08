import { TasksPluginReminderModel } from "model/format/reminder-tasks-plugin";
import { DateTime } from "model/time";
import moment from "moment";

describe('TasksPluginReminderLine', (): void => {
    test('parse()', (): void => {
        const parsed = TasksPluginReminderModel.parse("this is a title 🔁 every hour 📅 2021-09-08 ✅ 2021-08-31");
        expect(parsed.getTitle()).toBe("this is a title");
        expect(parsed.getTime().toString()).toBe("2021-09-08");
        expect(parsed.getDoneDate().toString()).toBe("2021-08-31");
    });
    test('setTitle()', (): void => {
        const parsed = TasksPluginReminderModel.parse("this is a title 🔁 every hour 📅 2021-09-08 ✅ 2021-08-31");
        parsed.setTitle("ABC");
        expect(parsed.getTitle()).toBe("ABC");
        expect(parsed.toMarkdown()).toBe("ABC 🔁 every hour 📅 2021-09-08 ✅ 2021-08-31");
    });
    test('setTime() - date', (): void => {
        const parsed = TasksPluginReminderModel.parse("this is a title 🔁 every hour 📅 2021-09-08 ✅ 2021-08-31");
        parsed.setTime(new DateTime(moment("2021-09-09"), false));
        expect(parsed.getTime().toString()).toBe("2021-09-09");
        expect(parsed.toMarkdown()).toBe("this is a title 🔁 every hour 📅 2021-09-09 ✅ 2021-08-31");
    });
    test('setTime() - string', (): void => {
        const parsed = TasksPluginReminderModel.parse("this is a title 🔁 every hour 📅 2021-09-08 ✅ 2021-08-31");
        parsed.setRawTime("XXX");
        expect(parsed.getTime()).toBe(null);
        expect(parsed.toMarkdown()).toBe("this is a title 🔁 every hour 📅 XXX ✅ 2021-08-31");
    });
    test('setTime() - append - with space', (): void => {
        const parsed = TasksPluginReminderModel.parse("this is a title 🔁 every hour ✅ 2021-08-31");
        parsed.setTime(new DateTime(moment("2021-09-08"), false));
        expect(parsed.getTime().toString()).toBe("2021-09-08");
        expect(parsed.toMarkdown()).toBe("this is a title 🔁 every hour ✅ 2021-08-31 📅 2021-09-08");
    });
    test('setTime() - append - without space', (): void => {
        const parsed = TasksPluginReminderModel.parse("this is a title 🔁every hour ✅2021-08-31");
        parsed.setTime(new DateTime(moment("2021-09-08"), false));
        expect(parsed.getTime().toString()).toBe("2021-09-08");
        expect(parsed.toMarkdown()).toBe("this is a title 🔁every hour ✅2021-08-31 📅2021-09-08");
    });
    test('setTime() - append - no advice', (): void => {
        const parsed = TasksPluginReminderModel.parse("this is a title");
        parsed.setTime(new DateTime(moment("2021-09-08"), false));
        expect(parsed.getTime().toString()).toBe("2021-09-08");
        expect(parsed.toMarkdown()).toBe("this is a title 📅 2021-09-08");
    });
});
