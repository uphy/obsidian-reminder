import { MarkdownDocument } from "model/format/markdown";
import { DateTime } from "model/time";
import moment from "moment";
import {
  ReminderFormatConfig,
  ReminderFormatParameterKey,
} from "./reminder-base";
import { ReminderFormatTestUtil } from "./reminder-base.test";
import {
  DataviewReminderFormat,
  DataviewReminderModel,
} from "./reminder-dataview";

describe("DataviewReminderFormat", (): void => {
  const util = new ReminderFormatTestUtil(() => new DataviewReminderFormat());

  describe("parse()", (): void => {
    test("date only, bracket style", (): void => {
      util.testParse({
        inputMarkdown: "- [ ] Buy milk [due:: 2025-05-17]",
        expectedTime: "2025-05-17",
        expectedTitle: "Buy milk",
        expectedSpan: { start: 15, end: 33 },
      });
    });

    test("datetime, T-separated shape", (): void => {
      util.testParse({
        inputMarkdown: "- [ ] Buy milk [due:: 2025-05-17T09:00]",
        expectedTime: "2025-05-17 09:00",
        expectedTitle: "Buy milk",
        expectedSpan: { start: 15, end: 39 },
      });
    });

    test("datetime, space-separated shape", (): void => {
      util.testParse({
        inputMarkdown: "- [ ] Buy milk [due:: 2025-05-17 09:00]",
        expectedTime: "2025-05-17 09:00",
        expectedTitle: "Buy milk",
        expectedSpan: { start: 15, end: 39 },
      });
    });

    test("paren style", (): void => {
      util.testParse({
        inputMarkdown: "- [ ] Buy milk (due:: 2025-05-17)",
        expectedTime: "2025-05-17",
        expectedTitle: "Buy milk",
        expectedSpan: { start: 15, end: 33 },
      });
    });

    test("reminder field wins over due", (): void => {
      util.testParse({
        inputMarkdown:
          "- [ ] Buy milk [due:: 2025-05-20] [reminder:: 2025-05-17]",
        expectedTime: "2025-05-17",
        expectedTitle: "Buy milk",
        expectedSpan: { start: 34, end: 57 },
      });
    });

    test("custom reminder field name wins over due", (): void => {
      util.testParse({
        inputMarkdown:
          "- [ ] Buy milk [due:: 2025-05-20] [remind:: 2025-05-17]",
        expectedTime: "2025-05-17",
        expectedTitle: "Buy milk",
        expectedSpan: { start: 34, end: 55 },
        configFunc: (config) => {
          config.setParameterValue(
            ReminderFormatParameterKey.dataviewReminderFieldName,
            "remind",
          );
        },
      });
    });

    test("a differently-named field is not the reminder field by default (falls back to due, stays in title)", (): void => {
      util.testParse({
        inputMarkdown:
          "- [ ] Buy milk [due:: 2025-05-20] [remind:: 2025-05-17]",
        expectedTime: "2025-05-20",
        expectedTitle: "Buy milk [remind:: 2025-05-17]",
      });
    });

    test("unrecognized fields stay in the title", (): void => {
      util.testParse({
        inputMarkdown: "- [ ] Buy milk [priority:: high] [due:: 2025-05-17]",
        expectedTime: "2025-05-17",
        expectedTitle: "Buy milk [priority:: high]",
      });
    });

    test("recognized-but-unused fields (scheduled/start) are stripped from the title", (): void => {
      util.testParse({
        inputMarkdown:
          "- [ ] Buy milk [scheduled:: 2025-05-15] [start:: 2025-05-14] [due:: 2025-05-17]",
        expectedTime: "2025-05-17",
        expectedTitle: "Buy milk",
      });
    });

    test("multiple due fields: first wins", (): void => {
      util.testParse({
        inputMarkdown: "- [ ] Buy milk [due:: 2025-05-17] [due:: 2025-06-01]",
        expectedTime: "2025-05-17",
        expectedTitle: "Buy milk",
      });
    });

    test("tag removal", (): void => {
      util.testParse({
        inputMarkdown: "- [ ] Buy milk #shopping [due:: 2025-05-17]",
        expectedTime: "2025-05-17",
        expectedTitle: "Buy milk",
        configFunc: (config) => {
          config.setParameterValue(
            ReminderFormatParameterKey.removeTagsForTasksPlugin,
            true,
          );
        },
      });
    });

    test("tags are kept by default", (): void => {
      util.testParse({
        inputMarkdown: "- [ ] Buy milk #shopping [due:: 2025-05-17]",
        expectedTime: "2025-05-17",
        expectedTitle: "Buy milk #shopping",
      });
    });

    test("span slices to the exact field text", (): void => {
      const inputMarkdown =
        "- [ ] Buy milk [due:: 2025-05-20] [reminder:: 2025-05-17]";
      const sut = new DataviewReminderFormat();
      sut.setConfig(new ReminderFormatConfig());
      const spans = sut.parse(new MarkdownDocument("file", inputMarkdown));
      const span = spans[0]!;
      expect(inputMarkdown.slice(span.columnStart, span.columnEnd)).toBe(
        "[reminder:: 2025-05-17]",
      );
    });

    test("fails closed: an unparsable due value yields no reminder", (): void => {
      const sut = new DataviewReminderFormat();
      sut.setConfig(new ReminderFormatConfig());
      const spans = sut.parse(
        new MarkdownDocument("file", "- [ ] Buy milk [due:: not-a-date]"),
      );
      expect(spans).toHaveLength(0);
    });

    test("fails closed: an unparsable reminder value does not fall back to a valid due value", (): void => {
      const sut = new DataviewReminderFormat();
      sut.setConfig(new ReminderFormatConfig());
      const spans = sut.parse(
        new MarkdownDocument(
          "file",
          "- [ ] Buy milk [due:: 2025-05-20] [reminder:: garbage]",
        ),
      );
      expect(spans).toHaveLength(0);
    });

    test("no due or reminder field at all: not a reminder", (): void => {
      const sut = new DataviewReminderFormat();
      sut.setConfig(new ReminderFormatConfig());
      const spans = sut.parse(
        new MarkdownDocument("file", "- [ ] Buy milk [priority:: high]"),
      );
      expect(spans).toHaveLength(0);
    });

    test("non-task lines are ignored", (): void => {
      const sut = new DataviewReminderFormat();
      sut.setConfig(new ReminderFormatConfig());
      const spans = sut.parse(
        new MarkdownDocument("file", "Buy milk [due:: 2025-05-17]"),
      );
      expect(spans).toHaveLength(0);
    });
  });

  describe("modify() - snooze", (): void => {
    test("rewrites the due field in place, preserving bracket style", async () => {
      await util.testModify({
        inputMarkdown: "- [ ] Buy milk [due:: 2025-05-17]",
        edit: { time: new DateTime(moment("2025-05-20"), false) },
        expectedMarkdown: "- [ ] Buy milk [due:: 2025-05-20]",
      });
    });

    test("rewrites the due field in place, preserving paren style", async () => {
      await util.testModify({
        inputMarkdown: "- [ ] Buy milk (due:: 2025-05-17)",
        edit: { time: new DateTime(moment("2025-05-20"), false) },
        expectedMarkdown: "- [ ] Buy milk (due:: 2025-05-20)",
      });
    });

    test("rewrites the reminder field (not due) when the reminder field is the source", async () => {
      await util.testModify({
        inputMarkdown:
          "- [ ] Buy milk [due:: 2025-05-20] (reminder:: 2025-05-17)",
        edit: { time: new DateTime(moment("2025-05-25 08:00"), true) },
        expectedMarkdown:
          "- [ ] Buy milk [due:: 2025-05-20] (reminder:: 2025-05-25T08:00)",
      });
    });

    test("writes a time-bearing value with the T-separated shape", async () => {
      await util.testModify({
        inputMarkdown: "- [ ] Buy milk [due:: 2025-05-17]",
        edit: { time: new DateTime(moment("2025-05-20 09:30"), true) },
        expectedMarkdown: "- [ ] Buy milk [due:: 2025-05-20T09:30]",
      });
    });
  });

  describe("modify() - done", (): void => {
    test("writes a date-only completion field", async () => {
      await util.testModify({
        inputMarkdown: "- [ ] Buy milk [due:: 2025-05-17]",
        edit: { checked: true },
        expectedMarkdown:
          "- [x] Buy milk [due:: 2025-05-17] [completion:: 2025-06-01]",
        configFunc: (config) => {
          config.setParameterValue(
            ReminderFormatParameterKey.now,
            new DateTime(moment("2025-06-01 10:00"), true),
          );
        },
      });
    });

    test("unchecking removes the completion field", async () => {
      await util.testModify({
        inputMarkdown:
          "- [x] Buy milk [due:: 2025-05-17] [completion:: 2025-06-01]",
        edit: { checked: false },
        expectedMarkdown: "- [ ] Buy milk [due:: 2025-05-17]",
      });
    });

    test("recurrence: inserts the next occurrence and completes the current one", async () => {
      await util.testModify({
        inputMarkdown: "- [ ] Task [repeat:: every day] [due:: 2025-05-17]",
        edit: { checked: true },
        expectedMarkdown: `- [ ] Task [repeat:: every day] [due:: 2025-05-19]
- [x] Task [repeat:: every day] [due:: 2025-05-17] [completion:: 2025-05-18]`,
        configFunc: (config) => {
          config.setParameterValue(
            ReminderFormatParameterKey.now,
            new DateTime(moment("2025-05-18"), true),
          );
        },
      });
    });

    test("recurrence with a separate reminder field: both due and reminder advance", async () => {
      await util.testModify({
        inputMarkdown:
          "- [ ] Task [repeat:: every day] [reminder:: 2025-05-17T09:00] [due:: 2025-05-17]",
        edit: { checked: true },
        expectedMarkdown: `- [ ] Task [repeat:: every day] [reminder:: 2025-05-19T09:00] [due:: 2025-05-19]
- [x] Task [repeat:: every day] [reminder:: 2025-05-17T09:00] [due:: 2025-05-17] [completion:: 2025-05-18]`,
        configFunc: (config) => {
          config.setParameterValue(
            ReminderFormatParameterKey.now,
            new DateTime(moment("2025-05-18 08:00"), true),
          );
        },
      });
    });
  });
});

describe("DataviewReminderModel", (): void => {
  test("newReminder() appends a [due:: ...] field", (): void => {
    const sut = new DataviewReminderFormat();
    sut.setConfig(new ReminderFormatConfig());
    const inserted = sut.appendReminder(
      "- [ ] Buy milk",
      new DateTime(moment("2025-05-17"), false),
    );
    expect(inserted!.insertedLine).toBe("- [ ] Buy milk [due:: 2025-05-17]");
  });

  test("clone() round-trips through toMarkdown()", (): void => {
    const model = DataviewReminderModel.parse(
      "Buy milk [due:: 2025-05-17]",
      "reminder",
    );
    const clone = model.clone();
    expect(clone.toMarkdown()).toBe(model.toMarkdown());
    expect(clone.getTime()!.toString()).toBe("2025-05-17");
  });
});
