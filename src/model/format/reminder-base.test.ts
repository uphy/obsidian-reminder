import { ReminderFormatConfig } from './reminder-base';
import { MarkdownDocument, ReminderEdit, ReminderFormat } from '.';

export class ReminderFormatTestUtil<T extends ReminderFormat> {
  constructor(private creator: () => T) {}

  testParse({
    inputMarkdown,
    expectedTime,
    expectedTitle,
    configFunc,
  }: {
    inputMarkdown: string;
    expectedTime: string;
    expectedTitle: string;
    configFunc?: (config: ReminderFormatConfig) => void;
  }) {
    const sut = this.creator();
    const config = new ReminderFormatConfig();
    if (configFunc) {
      configFunc(config);
    }
    sut.setConfig(config);

    const reminders = sut.parse(new MarkdownDocument('file', inputMarkdown));
    const reminder = reminders![0]!;
    expect(reminder.time.toString()).toBe(expectedTime);
    expect(reminder.title).toBe(expectedTitle);
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
    const doc = new MarkdownDocument('file', inputMarkdown);
    const sut = this.creator();
    const config = new ReminderFormatConfig();
    if (configFunc) {
      configFunc(config);
    }
    sut.setConfig(config);

    const reminders = sut.parse(doc);
    await sut.modify(doc, reminders![0]!, edit);
    expect(doc.toMarkdown()).toBe(expectedMarkdown);
  }
}

describe('Dummy', (): void => {
  test('dummy', (): void => {});
});
