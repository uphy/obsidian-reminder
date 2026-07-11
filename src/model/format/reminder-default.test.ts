import { ConstantReference } from "model/ref";
import { DATE_TIME_FORMATTER, DateTime } from "model/time";
import moment from "moment";
import { MarkdownDocument } from "./markdown";
import {
  ReminderFormatConfig,
  ReminderFormatParameterKey,
} from "./reminder-base";
import { ReminderFormatTestUtil } from "./reminder-base.test";
import {
  DefaultReminderFormat,
  DefaultReminderModel,
} from "./reminder-default";

function setStrict(strict: boolean) {
  DATE_TIME_FORMATTER.setTimeFormat(
    new ConstantReference("YYYY-MM-DD"),
    new ConstantReference("YYYY-MM-DD HH:mm"),
    new ConstantReference(strict),
  );
}

describe("DefaultReminderFormat", (): void => {
  const util = new ReminderFormatTestUtil(() => new DefaultReminderFormat());

  afterEach(() => {
    // DATE_TIME_FORMATTER is shared module state; restore the lenient
    // defaults so strict-mode tests don't leak into other test files.
    setStrict(false);
  });

  test("parse", (): void => {
    util.testParse({
      inputMarkdown: "- [ ] Task1 (@2021-09-14)",
      expectedTime: "2021-09-14",
      expectedTitle: "Task1",
      expectedSpan: { start: 12, end: 12 + 13 },
      configFunc: (config) => {
        config.setParameterValue(
          ReminderFormatParameterKey.linkDatesToDailyNotes,
          false,
        );
      },
    });
    util.testParse({
      inputMarkdown: "- [ ] Task1 (@2021-09-14 10:00)",
      expectedTime: "2021-09-14 10:00",
      expectedTitle: "Task1",
      expectedSpan: { start: 12, end: 12 + 19 },
      configFunc: (config) => {
        config.setParameterValue(
          ReminderFormatParameterKey.linkDatesToDailyNotes,
          false,
        );
      },
    });
  });
  test("parse - link dates to daily notes", (): void => {
    util.testParse({
      inputMarkdown: "- [ ] Task1 (@[[2021-09-14]] 10:00)",
      expectedTime: "2021-09-14 10:00",
      expectedTitle: "Task1",
      expectedSpan: { start: 12, end: 35 },
      configFunc: (config) => {
        config.setParameterValue(
          ReminderFormatParameterKey.linkDatesToDailyNotes,
          true,
        );
      },
    });
    util.testParse({
      inputMarkdown: "- [ ] Task1 (@[[2021-09-14]])",
      expectedTime: "2021-09-14",
      expectedTitle: "Task1",
      expectedSpan: { start: 12, end: 29 },
      configFunc: (config) => {
        config.setParameterValue(
          ReminderFormatParameterKey.linkDatesToDailyNotes,
          true,
        );
      },
    });
  });
  test("modify", async () => {
    await util.testModify({
      inputMarkdown: "- [ ] Task1 (@2021-09-14)",
      edit: {
        checked: true,
        time: new DateTime(moment("2021-09-15 10:00"), true),
      },
      expectedMarkdown: "- [x] Task1 (@2021-09-15 10:00)",
      configFunc: (config) => {
        config.setParameterValue(
          ReminderFormatParameterKey.linkDatesToDailyNotes,
          false,
        );
      },
    });
  });
  test("modify - link dates to daily notes", async () => {
    await util.testModify({
      inputMarkdown: "- [ ] Task1 (@[[2021-09-14]] 09:00)",
      edit: {
        checked: true,
        time: new DateTime(moment("2021-09-15 10:00"), true),
      },
      expectedMarkdown: "- [x] Task1 (@[[2021-09-15]] 10:00)",
      configFunc: (config) => {
        config.setParameterValue(
          ReminderFormatParameterKey.linkDatesToDailyNotes,
          true,
        );
      },
    });
  });

  describe("recurrence - parse", (): void => {
    test("date-only with recurrence", (): void => {
      util.testParse({
        inputMarkdown: "- [ ] Task1 (@2021-09-14 🔁every day)",
        expectedTime: "2021-09-14",
        expectedTitle: "Task1",
        // "- [ ] " (6) + "Task1 " (6) = 12; "(@2021-09-14 🔁every day)" is 25
        // UTF-16 units long (🔁 is a surrogate pair, 2 units).
        expectedSpan: { start: 12, end: 12 + 25 },
      });
    });
    test("datetime with recurrence", (): void => {
      util.testParse({
        inputMarkdown: "- [ ] Task1 (@2021-09-14 10:00 🔁every day)",
        expectedTime: "2021-09-14 10:00",
        expectedTitle: "Task1",
      });
    });
    test("with recurrence, strict date parsing off (non-regression)", (): void => {
      setStrict(false);
      util.testParse({
        inputMarkdown: "- [ ] Task1 (@2021-09-14 10:00 🔁every day)",
        expectedTime: "2021-09-14 10:00",
        expectedTitle: "Task1",
      });
    });
    test("with recurrence, strict date parsing on (regression: the datetime part is trimmed before strict parsing)", (): void => {
      setStrict(true);
      util.testParse({
        inputMarkdown: "- [ ] Task1 (@2021-09-14 10:00 🔁every day)",
        expectedTime: "2021-09-14 10:00",
        expectedTitle: "Task1",
      });
    });
    test("🔁 with an empty tail parses exactly as today (non-recurring)", (): void => {
      util.testParse({
        inputMarkdown: "- [ ] Task1 (@2021-09-14 🔁)",
        // Lenient parsing accepts the whole "2021-09-14 🔁" as a datetime,
        // matching today's (pre-recurrence) behavior.
        expectedTime: "2021-09-14 00:00",
        expectedTitle: "Task1",
      });
    });
    test("traditional form without 🔁 (non-regression)", (): void => {
      util.testParse({
        inputMarkdown: "- [ ] Task1 (@2021-09-14)",
        expectedTime: "2021-09-14",
        expectedTitle: "Task1",
      });
    });
  });

  describe("recurrence - model-level parse/toMarkdown", (): void => {
    test("empty datetime half produces no reminder via parse(), but appendReminder() fills the time and keeps the recurrence", (): void => {
      const format = new DefaultReminderFormat();
      format.setConfig(new ReminderFormatConfig());
      const doc = new MarkdownDocument("file", "- [ ] Task1 (@🔁every monday)");
      expect(format.parse(doc)).toEqual([]);

      const insertion = format.appendReminder(
        "- [ ] Task1 (@🔁every monday)",
        new DateTime(moment("2021-09-14"), false),
      );
      expect(insertion).not.toBeNull();
      expect(insertion!.insertedLine).toBe(
        "- [ ] Task1 (@2021-09-14 🔁every monday)",
      );
    });

    test("recurrence string round-trips verbatim through parse -> toMarkdown (canonical spacing)", (): void => {
      const model = DefaultReminderModel.parse(
        "Task1 (@2021-09-14 🔁every day)",
      )!;
      expect(model.recurrence).toBe("every day");
      expect(model.toMarkdown()).toBe("Task1 (@2021-09-14 🔁every day)");
    });

    test("two 🔁 in one paren: the model recurs by its leading prefix and round-trips verbatim", (): void => {
      const model = DefaultReminderModel.parse(
        "Task1 (@2021-09-14 🔁every day 🔁every week)",
      )!;
      expect(model.recurrence).toBe("every day 🔁every week");
      expect(model.toMarkdown()).toBe(
        "Task1 (@2021-09-14 🔁every day 🔁every week)",
      );
    });

    test("🔁x (no space before emoji) is normalized to the canonical single-space form", (): void => {
      const model = DefaultReminderModel.parse(
        "Task1 (@2021-09-14🔁every day)",
      )!;
      expect(model.recurrence).toBe("every day");
      expect(model.toMarkdown()).toBe("Task1 (@2021-09-14 🔁every day)");
    });

    test("🔁 x (space after emoji) is normalized to no space after the emoji", (): void => {
      const model = DefaultReminderModel.parse(
        "Task1 (@2021-09-14 🔁 every day)",
      )!;
      expect(model.recurrence).toBe("every day");
      expect(model.toMarkdown()).toBe("Task1 (@2021-09-14 🔁every day)");
    });

    test("trailing space before the closing paren is trimmed", (): void => {
      const model = DefaultReminderModel.parse(
        "Task1 (@2021-09-14 🔁every day )",
      )!;
      expect(model.recurrence).toBe("every day");
      expect(model.toMarkdown()).toBe("Task1 (@2021-09-14 🔁every day)");
    });

    test("Markdown output with linkDatesToDailyNotes enabled only wraps the first (datetime-part) occurrence of the date", (): void => {
      const model = DefaultReminderModel.parse(
        "Task1 (@2021-09-12 🔁every day until 2021-09-12)",
        true,
      )!;
      expect(model.toMarkdown()).toBe(
        "Task1 (@[[2021-09-12]] 🔁every day until 2021-09-12)",
      );
    });
  });

  describe("recurrence - modify", (): void => {
    test("next-occurrence line inserted above on {checked: true} (toggle-checklist-status shape, no time)", async () => {
      await util.testModify({
        inputMarkdown: "- [ ] Task (@2021-09-12 🔁every day)",
        edit: { checked: true },
        expectedMarkdown: `- [ ] Task (@2021-09-14 🔁every day)
- [x] Task (@2021-09-12 🔁every day)`,
        configFunc: (config) => {
          config.setParameterValue(
            ReminderFormatParameterKey.now,
            new DateTime(moment("2021-09-13"), true),
          );
        },
      });
    });

    test("next-occurrence line inserted above on {checked: true, time} (notification-modal shape)", async () => {
      await util.testModify({
        inputMarkdown: "- [ ] Task (@2021-09-12 🔁every day)",
        edit: {
          checked: true,
          time: new DateTime(moment("2021-09-12"), false),
        },
        expectedMarkdown: `- [ ] Task (@2021-09-14 🔁every day)
- [x] Task (@2021-09-12 🔁every day)`,
        configFunc: (config) => {
          config.setParameterValue(
            ReminderFormatParameterKey.now,
            new DateTime(moment("2021-09-13"), true),
          );
        },
      });
    });

    test("{checked: false} on a checked recurring line unchecks it without touching recurrence or removing the already-inserted next line", async () => {
      await util.testModify({
        inputMarkdown: `- [x] Task (@2021-09-12 🔁every day)
- [ ] Task (@2021-09-14 🔁every day)`,
        edit: { checked: false },
        expectedMarkdown: `- [ ] Task (@2021-09-12 🔁every day)
- [ ] Task (@2021-09-14 🔁every day)`,
        configFunc: (config) => {
          config.setParameterValue(
            ReminderFormatParameterKey.now,
            new DateTime(moment("2021-09-13"), true),
          );
        },
      });
    });

    test("a date-only recurring reminder stays date-only in the inserted line", async () => {
      await util.testModify({
        inputMarkdown: "- [ ] Task (@2021-09-12 🔁every day)",
        edit: { checked: true },
        expectedMarkdown: `- [ ] Task (@2021-09-14 🔁every day)
- [x] Task (@2021-09-12 🔁every day)`,
        configFunc: (config) => {
          config.setParameterValue(
            ReminderFormatParameterKey.now,
            new DateTime(moment("2021-09-13"), true),
          );
        },
      });
    });

    test("snooze re-anchoring: date-only snoozed to a datetime, then completed, yields a datetime next occurrence", async () => {
      const doc = new MarkdownDocument(
        "file",
        "- [ ] Task (@2021-09-12 🔁every day)",
      );
      const sut = new DefaultReminderFormat();
      const config = new ReminderFormatConfig();
      sut.setConfig(config);

      let spans = sut.parse(doc);
      await sut.modify(doc, spans[0]!.reminder, {
        time: new DateTime(moment("2021-09-12 15:00"), true),
      });
      expect(doc.toMarkdown()).toBe(
        "- [ ] Task (@2021-09-12 15:00 🔁every day)",
      );

      config.setParameterValue(
        ReminderFormatParameterKey.now,
        new DateTime(moment("2021-09-13 08:00"), true),
      );
      spans = sut.parse(doc);
      await sut.modify(doc, spans[0]!.reminder, { checked: true });
      expect(doc.toMarkdown()).toBe(
        `- [ ] Task (@2021-09-14 15:00 🔁every day)
- [x] Task (@2021-09-12 15:00 🔁every day)`,
      );
    });

    test("snooze re-anchoring: datetime snoozed to a date-only later, then completed, yields a date-only next occurrence", async () => {
      const doc = new MarkdownDocument(
        "file",
        "- [ ] Task (@2021-09-12 09:00 🔁every day)",
      );
      const sut = new DefaultReminderFormat();
      const config = new ReminderFormatConfig();
      sut.setConfig(config);

      let spans = sut.parse(doc);
      await sut.modify(doc, spans[0]!.reminder, {
        time: new DateTime(moment("2021-09-13"), false),
      });
      expect(doc.toMarkdown()).toBe("- [ ] Task (@2021-09-13 🔁every day)");

      config.setParameterValue(
        ReminderFormatParameterKey.now,
        new DateTime(moment("2021-09-13"), true),
      );
      spans = sut.parse(doc);
      await sut.modify(doc, spans[0]!.reminder, { checked: true });
      expect(doc.toMarkdown()).toBe(
        `- [ ] Task (@2021-09-14 🔁every day)
- [x] Task (@2021-09-13 🔁every day)`,
      );
    });

    test("a time edit (snooze) preserves the recurrence text", async () => {
      await util.testModify({
        inputMarkdown: "- [ ] Task (@2021-09-12 🔁every day)",
        edit: { time: new DateTime(moment("2021-09-12 15:00"), true) },
        expectedMarkdown: "- [ ] Task (@2021-09-12 15:00 🔁every day)",
      });
    });

    test("a rawTime edit preserves the recurrence text", async () => {
      await util.testModify({
        inputMarkdown: "- [ ] Task (@2021-09-12 🔁every day)",
        edit: { rawTime: "tomorrow" },
        expectedMarkdown: "- [ ] Task (@tomorrow 🔁every day)",
      });
    });

    test("invalid rrule text completes normally (no next occurrence inserted)", async () => {
      const warn = jest.spyOn(console, "warn").mockImplementation();
      await util.testModify({
        inputMarkdown: "- [ ] Task (@2021-09-12 🔁every)",
        edit: { checked: true },
        expectedMarkdown: "- [x] Task (@2021-09-12 🔁every)",
        configFunc: (config) => {
          config.setParameterValue(
            ReminderFormatParameterKey.now,
            new DateTime(moment("2021-09-13"), true),
          );
        },
      });
      expect(warn).toHaveBeenCalled();
      warn.mockRestore();
    });

    test("parse -> toMarkdown round trip: canonical form is unchanged across an edit", async () => {
      await util.testModify({
        inputMarkdown: "- [ ] Task (@2021-09-12 🔁every day)",
        edit: { time: new DateTime(moment("2021-09-13"), false) },
        expectedMarkdown: "- [ ] Task (@2021-09-13 🔁every day)",
      });
    });

    test("parse -> toMarkdown round trip: non-canonical spacing is normalized on edit", async () => {
      await util.testModify({
        inputMarkdown: "- [ ] Task (@2021-09-12 🔁 every day)",
        edit: { time: new DateTime(moment("2021-09-13"), false) },
        expectedMarkdown: "- [ ] Task (@2021-09-13 🔁every day)",
      });
    });
  });
});
