import { MarkdownDocument } from "model/format/markdown";
import { TasksPluginFormat, TasksPluginReminderModel } from "model/format/reminder-tasks-plugin";
import { DateTime } from "model/time";
import moment from "moment";
import { ReminderFormatConfig, ReminderFormatParameterKey, ReminderStatus } from "./reminder-base";

describe('TasksPluginReminderLine', (): void => {
    test('parse()', (): void => {
        const parsed = TasksPluginReminderModel.parse("this is a title 🔁 every hour 📅 2021-09-08 ✅ 2021-08-31");
        expect(parsed.getTitle()).toBe("this is a title");
        expect(parsed.getTime()!.toString()).toBe("2021-09-08");
        expect(parsed.getDoneDate()!.toString()).toBe("2021-08-31");
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
        expect(parsed.getTime()!.toString()).toBe("2021-09-09");
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
        expect(parsed.getTime()!.toString()).toBe("2021-09-08");
        expect(parsed.toMarkdown()).toBe("this is a title 🔁 every hour ✅ 2021-08-31 📅 2021-09-08");
    });
    test('setTime() - append - without space', (): void => {
        const parsed = TasksPluginReminderModel.parse("this is a title 🔁every hour ✅2021-08-31");
        parsed.setTime(new DateTime(moment("2021-09-08"), false));
        expect(parsed.getTime()!.toString()).toBe("2021-09-08");
        expect(parsed.toMarkdown()).toBe("this is a title 🔁every hour ✅2021-08-31 📅2021-09-08");
    });
    test('setTime() - append - no advice', (): void => {
        const parsed = TasksPluginReminderModel.parse("this is a title");
        parsed.setTime(new DateTime(moment("2021-09-08"), false));
        expect(parsed.getTime()!.toString()).toBe("2021-09-08");
        expect(parsed.toMarkdown()).toBe("this is a title 📅 2021-09-08");
    });
    test('modify() - default', async () => {
        await testModify({
            now: "2021-09-13",
            customEmoji: false,
            inputMarkdown: `- [ ] Task 🔁 every day 📅 2021-09-12`,
            expectedMarkdown: `- [ ] Task 🔁 every day 📅 2021-09-14
- [x] Task 🔁 every day 📅 2021-09-12 ✅ 2021-09-13`
        });
    });
    test('modify() - custom emoji', async () => {
        await testModify({
            now: "2021-09-13 09:10",
            customEmoji: true,
            inputMarkdown: `- [ ] Task ⏰ 2021-09-13 09:00 🔁 every day 📅 2021-09-12`,
            expectedMarkdown: `- [ ] Task ⏰ 2021-09-14 09:00 🔁 every day 📅 2021-09-14
- [x] Task ⏰ 2021-09-13 09:00 🔁 every day 📅 2021-09-12 ✅ 2021-09-13`
        });
    });
    test('modify() - custom emoji - reminder omission', async () => {
        await testModify({
            now: "2021-09-15 09:10",
            customEmoji: true,
            inputMarkdown: `- [ ] Task ⏰ 2021-09-13 09:00 🔁 every day 📅 2021-09-12`,
            expectedMarkdown: `- [ ] Task ⏰ 2021-09-16 09:00 🔁 every day 📅 2021-09-16
- [x] Task ⏰ 2021-09-13 09:00 🔁 every day 📅 2021-09-12 ✅ 2021-09-15`
        });
    });
    test('modify() - custom emoji - reminder emoji only', async () => {
        await testModify({
            now: "2021-09-15 09:10",
            customEmoji: true,
            inputMarkdown: `- [ ] Task ⏰ 2021-09-13 09:00`,
            expectedMarkdown: undefined
        });
    });
    test('modify() - custom emoji - reminder emoji only', async () => {
        await testModify({
            now: "2021-09-15 09:10",
            customEmoji: true,
            inputMarkdown: `- [ ] Task ⏰ 2021-09-13 09:00 📅 2021-09-13`,
            expectedMarkdown: `- [x] Task ⏰ 2021-09-13 09:00 📅 2021-09-13 ✅ 2021-09-15`
        });
    });
    test('modify() - default - every month', async () => {
        await testModify({
            now: "2021-09-13",
            customEmoji: false,
            inputMarkdown: `- [ ] Task 🔁 every month on the 5th 📅 2021-09-12`,
            expectedMarkdown: `- [ ] Task 🔁 every month on the 5th 📅 2021-10-05
- [x] Task 🔁 every month on the 5th 📅 2021-09-12 ✅ 2021-09-13`
        });
    });
    test('modify() - default - every month with time', async () => {
        await testModify({
            now: "2021-09-13 09:10",
            customEmoji: true,
            inputMarkdown: `- [ ] Task ⏰ 2021-09-05 11:00 🔁 every month on the 5th 📅 2021-09-12`,
            expectedMarkdown: `- [ ] Task ⏰ 2021-10-05 11:00 🔁 every month on the 5th 📅 2021-10-05
- [x] Task ⏰ 2021-09-05 11:00 🔁 every month on the 5th 📅 2021-09-12 ✅ 2021-09-13`
        });
    });
});

async function testModify({
    now,
    customEmoji,
    inputMarkdown,
    expectedMarkdown
}: {
    now: string,
    customEmoji: boolean,
    inputMarkdown: string,
    expectedMarkdown: string | undefined
}) {
    const doc = new MarkdownDocument("file", inputMarkdown);
    const sut = new TasksPluginFormat();
    const config = new ReminderFormatConfig();
    config.setParameterValue(ReminderFormatParameterKey.now, new DateTime(moment(now), true));
    config.setParameterValue(ReminderFormatParameterKey.useCustomEmojiForTasksPlugin, customEmoji);
    sut.setConfig(config);

    const reminders = sut.parse(doc);
    if (reminders.length === 0 && expectedMarkdown === undefined) {
        return;
    }
    await sut.modify(doc, reminders[0]!, { status: ReminderStatus.Done })
    expect(doc.toMarkdown()).toBe(expectedMarkdown);
}