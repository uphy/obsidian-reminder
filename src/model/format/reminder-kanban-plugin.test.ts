/**
 * @jest-environment
 */
import { DateTime } from "model/time";
import moment from "moment";
import {
  KanbanDateTimeFormat,
  KanbanReminderModel,
} from "./reminder-kanban-plugin";

describe("KanbanDateTimeFormat", (): void => {
  test("format - no page link", (): void => {
    const sut = new KanbanDateTimeFormat({
      dateTrigger: "@",
      dateFormat: "YYYY-MM-DD",
      timeTrigger: "@@",
      timeFormat: "HH:mm",
      linkDateToDailyNote: false,
    });
    expect(sut.format(new DateTime(moment("2021-09-12"), false))).toBe(
      "@{2021-09-12}",
    );
    expect(sut.format(new DateTime(moment("2021-09-12 07:51"), true))).toBe(
      "@{2021-09-12} @@{07:51}",
    );
  });
  test("format - with page link", (): void => {
    const sut = new KanbanDateTimeFormat({
      dateTrigger: "@",
      dateFormat: "YYYY-MM-DD",
      timeTrigger: "@@",
      timeFormat: "HH:mm",
      linkDateToDailyNote: true,
    });
    expect(sut.format(new DateTime(moment("2021-09-12"), false))).toBe(
      "@[[2021-09-12]]",
    );
    expect(sut.format(new DateTime(moment("2021-09-12 07:51"), true))).toBe(
      "@[[2021-09-12]] @@{07:51}",
    );
  });
  test("split - no page link", (): void => {
    const sut = new KanbanDateTimeFormat({
      dateTrigger: "@",
      dateFormat: "YYYY-MM-DD",
      timeTrigger: "@@",
      timeFormat: "HH:mm",
      linkDateToDailyNote: false,
    });

    {
      const res = sut.split("a b c @{2021-09-12} @@{08:06}");
      expect(res.title).toBe("a b c");
      expect(res.time!.toString()).toBe("2021-09-12 08:06");
    }
    {
      const res = sut.split("a b c @{2021-09-12}");
      expect(res.title).toBe("a b c");
      expect(res.time!.toString()).toBe("2021-09-12");
    }
    // invalid
    {
      const res = sut.split("a b c @{2021-09-12} @@{invalid}");
      expect(res.title).toBe("a b c @{2021-09-12} @@{invalid}");
      expect(res.time).toBe(undefined);
    }
    {
      const res = sut.split("a b c @@{invalid}");
      expect(res.title).toBe("a b c @@{invalid}");
      expect(res.time).toBe(undefined);
    }
  });
  test("split - with page link", (): void => {
    const sut = new KanbanDateTimeFormat({
      dateTrigger: "@",
      dateFormat: "YYYY-MM-DD",
      timeTrigger: "@@",
      timeFormat: "HH:mm",
      linkDateToDailyNote: true,
    });

    {
      const res = sut.split("a b c @[[2021-09-12]] @@{08:06}");
      expect(res.title).toBe("a b c");
      expect(res.time!.toString()).toBe("2021-09-12 08:06");
    }
    {
      const res = sut.split("a b c @[[2021-09-12]]");
      expect(res.title).toBe("a b c");
      expect(res.time!.toString()).toBe("2021-09-12");
    }
    // invalid
    {
      const res = sut.split("a b c @[[2021-09-12]] @@{invalid}");
      expect(res.title).toBe("a b c @[[2021-09-12]] @@{invalid}");
      expect(res.time).toBe(undefined);
    }
    {
      const res = sut.split("a b c @@{invalid}");
      expect(res.title).toBe("a b c @@{invalid}");
      expect(res.time).toBe(undefined);
    }
  });
});

describe("KanbanReminderFormat", (): void => {
  test("parse()", (): void => {
    const parsed = KanbanReminderModel.parse("task1 @{2021-09-08}");
    expect(parsed!.time.toString()).toBe("2021-09-08");
    expect(parsed!.getTime()!.toString()).toBe("2021-09-08");
    expect(parsed!.title).toBe("task1");
    // computeSpan() verification: "task1 " => 6 chars, "@{2021-09-08}" => 13 chars
    const span = parsed!.computeSpan();
    expect(span.start).toBe(6);
    expect(span.end).toBe(19);
  });
  test("parse() with time", (): void => {
    const parsed = KanbanReminderModel.parse("task1 @{2021-09-08} @@{12:15}");
    expect(parsed!.time.toString()).toBe("2021-09-08 12:15");
    expect(parsed!.title).toBe("task1");
    // computeSpan(): "task1 " (6) then "@{2021-09-08} @@{12:15}" length 13 + 1 + 9 = 23
    const span = parsed!.computeSpan();
    expect(span.start).toBe(6);
    expect(span.end).toBe(29);
  });
  test("setDate() simple", (): void => {
    const parsed = KanbanReminderModel.parse("task1 @{2021-09-07}");
    parsed!.setTime(new DateTime(moment("2021-09-08"), false));
    expect(parsed!.toMarkdown()).toBe("task1 @{2021-09-08}");
    // computeSpan() after update: same indices as parse() without time
    const span = parsed!.computeSpan();
    expect(span.start).toBe(6);
    expect(span.end).toBe(19);
  });
  test("setDate() with time", (): void => {
    const parsed = KanbanReminderModel.parse("task1 @{2021-09-07}");
    parsed!.setTime(new DateTime(moment("2021-09-08 10:00"), true));
    expect(parsed!.toMarkdown()).toBe("task1 @{2021-09-08} @@{10:00}");
    // "task1 " (6) + "@{2021-09-08} @@{10:00}" (13 + 1 + 9 = 23) => end 29
    const span = parsed!.computeSpan();
    expect(span.start).toBe(6);
    expect(span.end).toBe(29);
  });
});
