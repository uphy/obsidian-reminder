import { ReminderFormatConfig } from "./reminder-base";
import { MarkdownDocument } from ".";
import type { ReminderEdit, ReminderFormat, ReminderSpan } from ".";

export class ReminderFormatTestUtil<T extends ReminderFormat> {
  constructor(private creator: () => T) {}

  testParse({
    inputMarkdown,
    expectedTime,
    expectedTitle,
    expectedSpan,
    configFunc,
  }: {
    inputMarkdown: string;
    expectedTime: string;
    expectedTitle: string;
    expectedSpan?: { start: number; end: number };
    configFunc?: (config: ReminderFormatConfig) => void;
  }) {
    const sut = this.creator();
    const config = new ReminderFormatConfig();
    if (configFunc) {
      configFunc(config);
    }
    sut.setConfig(config);

    const spans = sut.parse(
      new MarkdownDocument("file", inputMarkdown),
    ) as ReminderSpan[];
    const span = spans![0]!;
    expect(span.reminder.time.toString()).toBe(expectedTime);
    expect(span.reminder.title).toBe(expectedTitle);
    if (expectedSpan) {
      expect({ start: span.columnStart, end: span.columnEnd }).toEqual(
        expectedSpan,
      );
    }
  }

  async testModify({
    inputMarkdown,
    edit,
    expectedMarkdown,
    configFunc,
  }: {
    inputMarkdown: string;
    edit: ReminderEdit;
    expectedMarkdown: string;
    configFunc?: (config: ReminderFormatConfig) => void;
  }) {
    const doc = new MarkdownDocument("file", inputMarkdown);
    const sut = this.creator();
    const config = new ReminderFormatConfig();
    if (configFunc) {
      configFunc(config);
    }
    sut.setConfig(config);

    const spans = sut.parse(doc) as ReminderSpan[];
    await sut.modify(doc, spans![0]!.reminder, edit);
    expect(doc.toMarkdown()).toBe(expectedMarkdown);
  }
}

describe("Dummy", (): void => {
  test("dummy", (): void => {});
});
