import { MarkdownDocument } from "model/format/markdown";
import {
  TasksPluginFormat,
  TasksPluginReminderModel,
} from "model/format/reminder-tasks-plugin";
import { DateTime } from "model/time";
import moment from "moment";
import {
  ReminderFormatConfig,
  ReminderFormatParameterKey,
} from "./reminder-base";

describe("TasksPluginReminderLine", (): void => {
  test("parse()", (): void => {
    const parsed = TasksPluginReminderModel.parse(
      "this is a title 🔁 every hour 📅 2021-09-08 ✅ 2021-08-31",
    );
    expect(parsed.getTitle()).toBe("this is a title");
    expect(parsed.getTime()!.toString()).toBe("2021-09-08");
    expect(parsed.getDoneDate()!.toString()).toBe("2021-08-31");
    // "this is a title " (16) + "🔁 every hour " (14, 🔁 is a UTF-16
    // surrogate pair) = 30 chars before "📅"; the span covers "📅 2021-09-08"
    // (13 chars), trimmed of the trailing separator space before "✅".
    const span = parsed.computeSpan();
    expect(span.start).toBe(30);
    expect(span.end).toBe(43);
  });
  test("parse() - due date with time part", (): void => {
    const parsed = TasksPluginReminderModel.parse("task 📅 2021-09-16 10:00");
    expect(parsed.getDueDate()!.toString()).toBe("2021-09-16 10:00");
    expect(parsed.getDueDate()!.hasTimePart).toBe(true);
    // Without custom emoji, getTime() reads from the due-date symbol too.
    expect(parsed.getTime()!.toString()).toBe("2021-09-16 10:00");
  });
  test("parse() - due date without time part (unchanged)", (): void => {
    const parsed = TasksPluginReminderModel.parse("task 📅 2021-09-16");
    expect(parsed.getDueDate()!.toString()).toBe("2021-09-16");
    expect(parsed.getDueDate()!.hasTimePart).toBe(false);
  });
  test("getTitle() - remove tags", (): void => {
    const parse = (line: string) =>
      TasksPluginReminderModel.parse(line, false, true);
    expect(parse("Task1 #task 📅 2021-09-08").getTitle()).toBe("Task1");
    // nested tag
    expect(parse("Task1 #task/sub 📅 2021-09-08").getTitle()).toBe("Task1");
    // non-ASCII tag (https://github.com/uphy/obsidian-reminder/issues/169)
    expect(parse("Task1 #zokjfkdsaób 📅 2021-09-08").getTitle()).toBe("Task1");
  });
  test("setTitle()", (): void => {
    const parsed = TasksPluginReminderModel.parse(
      "this is a title 🔁 every hour 📅 2021-09-08 ✅ 2021-08-31",
    );
    parsed.setTitle("ABC");
    expect(parsed.getTitle()).toBe("ABC");
    expect(parsed.toMarkdown()).toBe(
      "ABC 🔁 every hour 📅 2021-09-08 ✅ 2021-08-31",
    );
    const span = parsed.computeSpan();
    expect(span.start).toBe(18);
    expect(span.end).toBe(31);
  });
  test("setTime() - date", (): void => {
    const parsed = TasksPluginReminderModel.parse(
      "this is a title 🔁 every hour 📅 2021-09-08 ✅ 2021-08-31",
    );
    parsed.setTime(new DateTime(moment("2021-09-09"), false));
    expect(parsed.getTime()!.toString()).toBe("2021-09-09");
    expect(parsed.toMarkdown()).toBe(
      "this is a title 🔁 every hour 📅 2021-09-09 ✅ 2021-08-31",
    );
    const span = parsed.computeSpan();
    expect(span.start).toBe(30);
    expect(span.end).toBe(43);
  });
  test("setTime() - due date with time part", (): void => {
    const parsed = TasksPluginReminderModel.parse(
      "this is a title 🔁 every hour 📅 2021-09-08 ✅ 2021-08-31",
    );
    parsed.setTime(new DateTime(moment("2021-09-16 10:00"), true));
    expect(parsed.getTime()!.toString()).toBe("2021-09-16 10:00");
    expect(parsed.toMarkdown()).toBe(
      "this is a title 🔁 every hour 📅 2021-09-16 10:00 ✅ 2021-08-31",
    );
  });
  test("setTime() - string", (): void => {
    const parsed = TasksPluginReminderModel.parse(
      "this is a title 🔁 every hour 📅 2021-09-08 ✅ 2021-08-31",
    );
    parsed.setRawTime("XXX");
    expect(parsed.getTime()).toBe(null);
    expect(parsed.toMarkdown()).toBe(
      "this is a title 🔁 every hour 📅 XXX ✅ 2021-08-31",
    );
    const span = parsed.computeSpan();
    expect(span.start).toBe(30);
    expect(span.end).toBe(36);
  });
  test("setTime() - append - with space", (): void => {
    const parsed = TasksPluginReminderModel.parse(
      "this is a title 🔁 every hour ✅ 2021-08-31",
    );
    parsed.setTime(new DateTime(moment("2021-09-08"), false));
    expect(parsed.getTime()!.toString()).toBe("2021-09-08");
    expect(parsed.toMarkdown()).toBe(
      "this is a title 🔁 every hour ✅ 2021-08-31 📅 2021-09-08",
    );
    // 📅 is the last token here (no trailing separator), so the span runs to
    // the very end of the line (verified against `toMarkdown().length`).
    const span = parsed.computeSpan();
    expect(span.start).toBe(43);
    expect(span.end).toBe(56);
  });
  test("setTime() - append - without space", (): void => {
    const parsed = TasksPluginReminderModel.parse(
      "this is a title 🔁every hour ✅2021-08-31",
    );
    parsed.setTime(new DateTime(moment("2021-09-08"), false));
    expect(parsed.getTime()!.toString()).toBe("2021-09-08");
    expect(parsed.toMarkdown()).toBe(
      "this is a title 🔁every hour ✅2021-08-31 📅2021-09-08",
    );
    // 📅 is again the last token, so the span runs to the end of the line.
    const span = parsed.computeSpan();
    expect(span.start).toBe(41);
    expect(span.end).toBe(53);
  });
  test("setTime() - tag after due date is preserved (#141)", (): void => {
    const parsed = TasksPluginReminderModel.parse("Task 📅 2021-09-08 #mytag");
    parsed.setTime(new DateTime(moment("2021-09-09"), false));
    expect(parsed.getTime()!.toString()).toBe("2021-09-09");
    expect(parsed.toMarkdown()).toBe("Task 📅 2021-09-09 #mytag");
  });
  test("setTime() - tag between due date and done date is preserved (#141)", (): void => {
    const parsed = TasksPluginReminderModel.parse(
      "Task 📅 2021-09-08 #mytag ✅ 2021-08-31",
    );
    parsed.setTime(new DateTime(moment("2021-09-09"), false));
    expect(parsed.getTime()!.toString()).toBe("2021-09-09");
    expect(parsed.toMarkdown()).toBe("Task 📅 2021-09-09 #mytag ✅ 2021-08-31");
  });
  test("setTime() - date without a tag still works (#141 regression guard)", (): void => {
    const parsed = TasksPluginReminderModel.parse("Task 📅 2021-09-08");
    parsed.setTime(new DateTime(moment("2021-09-09"), false));
    expect(parsed.getTime()!.toString()).toBe("2021-09-09");
    expect(parsed.toMarkdown()).toBe("Task 📅 2021-09-09");
  });
  test("setTime() - append - no advice", (): void => {
    const parsed = TasksPluginReminderModel.parse("this is a title");
    parsed.setTime(new DateTime(moment("2021-09-08"), false));
    expect(parsed.getTime()!.toString()).toBe("2021-09-08");
    expect(parsed.toMarkdown()).toBe("this is a title 📅 2021-09-08");
    // 📅 is the only/last token, so the span covers the full remaining text.
    const span = parsed.computeSpan();
    expect(span.start).toBe(16);
    expect(span.end).toBe(29);
  });
  test("modify() - default", async () => {
    await testModify({
      now: "2021-09-13",
      customEmoji: false,
      inputMarkdown: "- [ ] Task 🔁 every day 📅 2021-09-12",
      expectedMarkdown: `- [ ] Task 🔁 every day 📅 2021-09-14
- [x] Task 🔁 every day 📅 2021-09-12 ✅ 2021-09-13`,
    });
  });
  test("modify() - custom emoji", async () => {
    await testModify({
      now: "2021-09-13 09:10",
      customEmoji: true,
      inputMarkdown:
        "- [ ] Task ⏰ 2021-09-13 09:00 🔁 every day 📅 2021-09-12",
      expectedMarkdown: `- [ ] Task ⏰ 2021-09-14 09:00 🔁 every day 📅 2021-09-14
- [x] Task ⏰ 2021-09-13 09:00 🔁 every day 📅 2021-09-12 ✅ 2021-09-13`,
    });
  });
  test("modify() - custom emoji - reminder omission", async () => {
    await testModify({
      now: "2021-09-15 09:10",
      customEmoji: true,
      inputMarkdown:
        "- [ ] Task ⏰ 2021-09-13 09:00 🔁 every day 📅 2021-09-12",
      expectedMarkdown: `- [ ] Task ⏰ 2021-09-16 09:00 🔁 every day 📅 2021-09-16
- [x] Task ⏰ 2021-09-13 09:00 🔁 every day 📅 2021-09-12 ✅ 2021-09-15`,
    });
  });
  test("modify() - custom emoji - reminder emoji only", async () => {
    await testModify({
      now: "2021-09-15 09:10",
      customEmoji: true,
      inputMarkdown: "- [ ] Task ⏰ 2021-09-13 09:00",
      expectedMarkdown: undefined,
    });
  });
  test("modify() - custom emoji - reminder emoji only", async () => {
    await testModify({
      now: "2021-09-15 09:10",
      customEmoji: true,
      inputMarkdown: "- [ ] Task ⏰ 2021-09-13 09:00 📅 2021-09-13",
      expectedMarkdown:
        "- [x] Task ⏰ 2021-09-13 09:00 📅 2021-09-13 ✅ 2021-09-15",
    });
  });
  test("modify() - default - due date with time part is preserved across recurrence", async () => {
    await testModify({
      now: "2021-09-13",
      customEmoji: false,
      inputMarkdown: "- [ ] Task 🔁 every day 📅 2021-09-12 10:00",
      expectedMarkdown: `- [ ] Task 🔁 every day 📅 2021-09-14 10:00
- [x] Task 🔁 every day 📅 2021-09-12 10:00 ✅ 2021-09-13`,
    });
  });
  test("modify() - default - every month", async () => {
    await testModify({
      now: "2021-09-13",
      customEmoji: false,
      inputMarkdown: "- [ ] Task 🔁 every month on the 5th 📅 2021-09-12",
      expectedMarkdown: `- [ ] Task 🔁 every month on the 5th 📅 2021-10-05
- [x] Task 🔁 every month on the 5th 📅 2021-09-12 ✅ 2021-09-13`,
    });
  });
  test("modify() - default - every month with time", async () => {
    await testModify({
      now: "2021-09-13 09:10",
      customEmoji: true,
      inputMarkdown:
        "- [ ] Task ⏰ 2021-09-05 11:00 🔁 every month on the 5th 📅 2021-09-12",
      expectedMarkdown: `- [ ] Task ⏰ 2021-10-05 11:00 🔁 every month on the 5th 📅 2021-10-05
- [x] Task ⏰ 2021-09-05 11:00 🔁 every month on the 5th 📅 2021-09-12 ✅ 2021-09-13`,
    });
  });
});

describe("TasksPluginReminderModel - reminder-time fallback (⏰ → 📅 → ⏳ → 🛫)", (): void => {
  test("fallback off, custom emoji off: reads 📅 regardless of ⏰/⏳/🛫 presence", (): void => {
    const spans = parseLine(
      "- [ ] Task ⏰ 2021-09-10 📅 2021-09-08 ⏳ 2021-09-05 🛫 2021-09-01",
    );
    expect(spans).toHaveLength(1);
    expect(spans[0]!.reminder.time.toString()).toBe("2021-09-08");
  });

  test("legacy (fallback off, custom emoji on): 📅 without ⏰ is not recognized", (): void => {
    const spans = parseLine("- [ ] Task 📅 2021-09-08", { customEmoji: true });
    expect(spans).toHaveLength(0);
  });

  test("legacy (fallback off, custom emoji on): ⏰ + 📅 both present reads ⏰", (): void => {
    const spans = parseLine("- [ ] Task ⏰ 2021-09-10 📅 2021-09-08", {
      customEmoji: true,
    });
    expect(spans).toHaveLength(1);
    expect(spans[0]!.reminder.time.toString()).toBe("2021-09-10");
  });

  test("legacy (fallback off, custom emoji on): ⏰ without 📅 is not recognized (unchanged)", (): void => {
    const spans = parseLine("- [ ] Task ⏰ 2021-09-10", { customEmoji: true });
    expect(spans).toHaveLength(0);
  });

  test("fallback on: falls back to 📅 when ⏰ is absent (#67)", (): void => {
    const spans = parseLine("- [ ] Task 📅 2021-09-08", {
      customEmoji: true,
      dueDateFallback: true,
    });
    expect(spans).toHaveLength(1);
    expect(spans[0]!.reminder.time.toString()).toBe("2021-09-08");
  });

  test("fallback on: falls back to ⏳ when ⏰ and 📅 are absent (#113, ⏳-only)", (): void => {
    const spans = parseLine("- [ ] Task ⏳ 2021-09-05", {
      customEmoji: true,
      dueDateFallback: true,
    });
    expect(spans).toHaveLength(1);
    expect(spans[0]!.reminder.time.toString()).toBe("2021-09-05");
  });

  test("fallback on: falls back to 🛫 when ⏰, 📅, and ⏳ are absent", (): void => {
    const spans = parseLine("- [ ] Task 🛫 2021-09-01", {
      customEmoji: true,
      dueDateFallback: true,
    });
    expect(spans).toHaveLength(1);
    expect(spans[0]!.reminder.time.toString()).toBe("2021-09-01");
  });

  test("fallback on: 📅 outranks ⏳ when both are present (intentional priority-ranking gap)", (): void => {
    const spans = parseLine("- [ ] Task 📅 2021-09-08 ⏳ 2021-09-05", {
      customEmoji: true,
      dueDateFallback: true,
    });
    expect(spans).toHaveLength(1);
    expect(spans[0]!.reminder.time.toString()).toBe("2021-09-08");
  });

  test("fallback on: a malformed ⏰ blocks fallback to a valid 📅 (presence, not validity)", (): void => {
    const spans = parseLine("- [ ] Task ⏰ not-a-date 📅 2021-09-08", {
      customEmoji: true,
      dueDateFallback: true,
    });
    expect(spans).toHaveLength(0);
  });

  describe("appendReminder() gate parity", (): void => {
    const line = "- [ ] Task ⏰ 2021-09-13 09:00";
    const time = new DateTime(moment("2021-09-20 10:00"), true);

    test("fallback on: the ⏰-only line is already tracked, so appendReminder() only calls setTime() and does not back-fill 📅", (): void => {
      const sut = new TasksPluginFormat();
      const config = new ReminderFormatConfig();
      config.setParameterValue(
        ReminderFormatParameterKey.useCustomEmojiForTasksPlugin,
        true,
      );
      config.setParameterValue(
        ReminderFormatParameterKey.useReminderTimeFallbackForTasksPlugin,
        true,
      );
      sut.setConfig(config);
      const inserted = sut.appendReminder(line, time);
      expect(inserted!.insertedLine).toContain("⏰ 2021-09-20 10:00");
      expect(inserted!.insertedLine).not.toContain("📅");
    });

    test("fallback off: the same ⏰-only line is not tracked, so appendReminder() goes through newReminder() and back-fills 📅", (): void => {
      const sut = new TasksPluginFormat();
      const config = new ReminderFormatConfig();
      config.setParameterValue(
        ReminderFormatParameterKey.useCustomEmojiForTasksPlugin,
        true,
      );
      sut.setConfig(config);
      const inserted = sut.appendReminder(line, time);
      expect(inserted!.insertedLine).toContain("📅");
    });
  });

  describe("recurrence / #106: ⏰-only recurring line with no 📅", (): void => {
    test("fallback on: regenerates with an advanced ⏰ and no fabricated 📅", async () => {
      await testModify({
        now: "2021-09-13 09:10",
        customEmoji: true,
        dueDateFallback: true,
        inputMarkdown: "- [ ] Task ⏰ 2021-09-13 09:00 🔁 every day",
        expectedMarkdown: `- [ ] Task ⏰ 2021-09-14 09:00 🔁 every day
- [x] Task ⏰ 2021-09-13 09:00 🔁 every day ✅ 2021-09-13`,
      });
    });

    test("fallback off: the same line never becomes a tracked reminder (gate rejects before recurrence is reachable)", async () => {
      await testModify({
        now: "2021-09-13 09:10",
        customEmoji: true,
        dueDateFallback: false,
        inputMarkdown: "- [ ] Task ⏰ 2021-09-13 09:00 🔁 every day",
        expectedMarkdown: undefined,
      });
    });
  });

  describe("recurrence hasTimePart fix: date-only ⏰ stays date-only (both fallback modes)", (): void => {
    test("fallback on: date-only ⏰ recurring line (with 📅 present) regenerates without a fabricated 00:00", async () => {
      await testModify({
        now: "2021-09-13",
        customEmoji: true,
        dueDateFallback: true,
        inputMarkdown: "- [ ] Task ⏰ 2021-09-12 🔁 every day 📅 2021-09-12",
        expectedMarkdown: `- [ ] Task ⏰ 2021-09-14 🔁 every day 📅 2021-09-14
- [x] Task ⏰ 2021-09-12 🔁 every day 📅 2021-09-12 ✅ 2021-09-13`,
      });
    });

    test("fallback off: date-only ⏰ recurring line (with 📅 present) regenerates without a fabricated 00:00", async () => {
      await testModify({
        now: "2021-09-13",
        customEmoji: true,
        dueDateFallback: false,
        inputMarkdown: "- [ ] Task ⏰ 2021-09-12 🔁 every day 📅 2021-09-12",
        expectedMarkdown: `- [ ] Task ⏰ 2021-09-14 🔁 every day 📅 2021-09-14
- [x] Task ⏰ 2021-09-12 🔁 every day 📅 2021-09-12 ✅ 2021-09-13`,
      });
    });
  });
});

function parseLine(
  markdown: string,
  options: { customEmoji?: boolean; dueDateFallback?: boolean } = {},
) {
  const sut = new TasksPluginFormat();
  const config = new ReminderFormatConfig();
  if (options.customEmoji !== undefined) {
    config.setParameterValue(
      ReminderFormatParameterKey.useCustomEmojiForTasksPlugin,
      options.customEmoji,
    );
  }
  if (options.dueDateFallback !== undefined) {
    config.setParameterValue(
      ReminderFormatParameterKey.useReminderTimeFallbackForTasksPlugin,
      options.dueDateFallback,
    );
  }
  sut.setConfig(config);
  return sut.parse(new MarkdownDocument("file", markdown));
}

async function testModify({
  now,
  customEmoji,
  dueDateFallback = false,
  inputMarkdown,
  expectedMarkdown,
}: {
  now: string;
  customEmoji: boolean;
  dueDateFallback?: boolean;
  inputMarkdown: string;
  expectedMarkdown: string | undefined;
}) {
  const doc = new MarkdownDocument("file", inputMarkdown);
  const sut = new TasksPluginFormat();
  const config = new ReminderFormatConfig();
  config.setParameterValue(
    ReminderFormatParameterKey.now,
    new DateTime(moment(now), true),
  );
  config.setParameterValue(
    ReminderFormatParameterKey.useCustomEmojiForTasksPlugin,
    customEmoji,
  );
  config.setParameterValue(
    ReminderFormatParameterKey.useReminderTimeFallbackForTasksPlugin,
    dueDateFallback,
  );
  sut.setConfig(config);

  const spans = sut.parse(doc);
  if (spans.length === 0 && expectedMarkdown === undefined) {
    return;
  }
  await sut.modify(doc, spans[0]!.reminder, { checked: true });
  expect(doc.toMarkdown()).toBe(expectedMarkdown);
}
