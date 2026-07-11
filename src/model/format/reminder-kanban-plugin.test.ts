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
  test("split - reflects setting changes after construction", (): void => {
    // The Kanban plugin's settings are read lazily, so toggling
    // "link date to daily note" must be reflected without recreating the
    // format instance (https://github.com/uphy/obsidian-reminder/issues/30).
    const setting = {
      dateTrigger: "@",
      dateFormat: "YYYY-MM-DD",
      timeTrigger: "@@",
      timeFormat: "HH:mm",
      linkDateToDailyNote: false,
    };
    const sut = new KanbanDateTimeFormat(setting);
    expect(sut.split("a b c @{2021-09-12}").time!.toString()).toBe(
      "2021-09-12",
    );
    expect(sut.split("a b c @[[2021-09-12]]").time).toBe(undefined);

    setting.linkDateToDailyNote = true;
    const res = sut.split("a b c @[[2021-09-12]]");
    expect(res.title).toBe("a b c");
    expect(res.time!.toString()).toBe("2021-09-12");
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
  });
  test("parse() with time", (): void => {
    const parsed = KanbanReminderModel.parse("task1 @{2021-09-08} @@{12:15}");
    expect(parsed!.time.toString()).toBe("2021-09-08 12:15");
    expect(parsed!.title).toBe("task1");
  });
  test("setDate() simple", (): void => {
    const parsed = KanbanReminderModel.parse("task1 @{2021-09-07}");
    parsed!.setTime(new DateTime(moment("2021-09-08"), false));
    expect(parsed!.toMarkdown()).toBe("task1 @{2021-09-08}");
  });
  test("setDate() with time", (): void => {
    const parsed = KanbanReminderModel.parse("task1 @{2021-09-07}");
    parsed!.setTime(new DateTime(moment("2021-09-08 10:00"), true));
    expect(parsed!.toMarkdown()).toBe("task1 @{2021-09-08} @@{10:00}");
  });
});
