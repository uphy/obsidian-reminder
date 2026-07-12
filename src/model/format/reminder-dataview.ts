import type { Todo } from "model/format/markdown";
import { DateTime } from "model/time";
import moment from "moment";
import type { InlineField } from "./inline-field";
import {
  appendField,
  parseInlineFields,
  removeField,
  replaceFieldValue,
} from "./inline-field";
import { ReminderFormatParameterKey } from "./reminder-base";
import { TasksLikeReminderFormat, removeTags } from "./reminder-tasks-like";
import type { TasksLikeReminderModel } from "./reminder-tasks-like";

// Value parsing is strict-only, tried in this order (see design doc
// "Syntax supported"). Unlike the Reminder plugin's own format, the global
// `strictDateFormat` setting doesn't loosen this: dataview field values are
// machine-formatted, so loose parsing would only reintroduce the class of
// silently-wrong-time bugs this format is meant to avoid (#108).
const DATE_TIME_FORMATS = ["YYYY-MM-DDTHH:mm", "YYYY-MM-DD HH:mm"];
const DATE_FORMAT = "YYYY-MM-DD";

function parseValue(raw: string): DateTime | null {
  for (const format of DATE_TIME_FORMATS) {
    const m = moment(raw, format, true);
    if (m.isValid()) {
      return new DateTime(m, true);
    }
  }
  const m = moment(raw, DATE_FORMAT, true);
  if (m.isValid()) {
    return new DateTime(m, false);
  }
  return null;
}

function formatValue(time: DateTime): string {
  if (time.hasTimePart) {
    return time.format("YYYY-MM-DDTHH:mm");
  }
  return time.format(DATE_FORMAT);
}

const KEY_DUE = "due";
const KEY_COMPLETION = "completion";
const KEY_REPEAT = "repeat";
const KEY_SCHEDULED = "scheduled";
const KEY_START = "start";
// Recognized-but-unused fields: kept out of the title (like the other
// recognized fields), but otherwise not read or written by this format.
const RECOGNIZED_KEYS = [
  KEY_DUE,
  KEY_COMPLETION,
  KEY_REPEAT,
  KEY_SCHEDULED,
  KEY_START,
];

export class DataviewReminderModel implements TasksLikeReminderModel {
  public static parse(
    line: string,
    reminderFieldName: string,
    removeTags?: boolean,
  ): DataviewReminderModel {
    return new DataviewReminderModel(
      line,
      reminderFieldName.toLowerCase(),
      removeTags ?? false,
    );
  }

  private constructor(
    private text: string,
    private reminderFieldName: string,
    private removeTags: boolean,
  ) {}

  private fields(): InlineField[] {
    return parseInlineFields(this.text);
  }

  private fieldsByKey(key: string): InlineField[] {
    return this.fields().filter((f) => f.key.toLowerCase() === key);
  }

  private firstField(key: string): InlineField | null {
    return this.fieldsByKey(key)[0] ?? null;
  }

  /** Whether this line has a reminder field distinct from `due`. */
  hasReminderField(): boolean {
    return this.firstField(this.reminderFieldName) != null;
  }

  /** Whether this line carries either a reminder field or a `due` field at all. */
  hasAnySourceField(): boolean {
    return this.hasReminderField() || this.firstField(KEY_DUE) != null;
  }

  /**
   * The field this reminder's time is read from / written to: the
   * configured reminder field when present, otherwise `due`. Per-line rule
   * — no global toggle, unlike the Tasks plugin's emoji format.
   */
  private reminderSourceField(): InlineField | null {
    return this.firstField(this.reminderFieldName) ?? this.firstField(KEY_DUE);
  }

  getTitle(): string | null {
    const keysToStrip = new Set<string>([
      ...RECOGNIZED_KEYS,
      this.reminderFieldName,
    ]);
    // Remove fields right-to-left so earlier (untouched) fields keep their
    // original indices valid while later ones are removed.
    const toRemove = this.fields()
      .filter((f) => keysToStrip.has(f.key.toLowerCase()))
      .sort((a, b) => b.start - a.start);
    let result = this.text;
    for (const field of toRemove) {
      result = removeField(result, field);
    }
    result = result.trim();
    if (this.removeTags) {
      result = removeTags(result);
    }
    return result;
  }

  getTime(): DateTime | null {
    const field = this.reminderSourceField();
    if (field == null) {
      return null;
    }
    return parseValue(field.value);
  }

  setTime(time: DateTime): void {
    const field = this.reminderSourceField();
    const key = field?.key ?? KEY_DUE;
    this.setFieldValue(key, formatValue(time));
  }

  setRawTime(rawTime: string): boolean {
    const field = this.reminderSourceField();
    const key = field?.key ?? KEY_DUE;
    this.setFieldValue(key, rawTime);
    return true;
  }

  getDueDate(): DateTime | null {
    const field = this.firstField(KEY_DUE);
    if (field == null) {
      return null;
    }
    return parseValue(field.value);
  }

  setDueDate(time: DateTime): void {
    this.setFieldValue(KEY_DUE, formatValue(time));
  }

  getRecurrence(): string | null {
    const field = this.firstField(KEY_REPEAT);
    return field?.value ?? null;
  }

  getDoneDate(): DateTime | null {
    const field = this.firstField(KEY_COMPLETION);
    if (field == null) {
      return null;
    }
    return parseValue(field.value);
  }

  setDoneDate(time: DateTime | string | undefined): void {
    if (time == null) {
      this.removeFieldByKey(KEY_COMPLETION);
      return;
    }
    // Completion date is always written date-only, mirroring the Tasks
    // plugin's own ✅ semantics (see the Tasks-plugin emoji format's
    // setDoneDate, which likewise ignores the incoming DateTime's time
    // part).
    const value = time instanceof DateTime ? time.format(DATE_FORMAT) : time;
    this.setFieldValue(KEY_COMPLETION, value);
  }

  getEndOfTimeTextIndex(): number {
    const field = this.reminderSourceField();
    if (field != null) {
      return field.end;
    }
    return this.toMarkdown().length;
  }

  computeSpan(): { start: number; end: number } {
    const field = this.reminderSourceField();
    if (field == null) {
      return { start: 0, end: 0 };
    }
    return { start: field.start, end: field.end };
  }

  toMarkdown(): string {
    return this.text;
  }

  clone(): DataviewReminderModel {
    return DataviewReminderModel.parse(
      this.toMarkdown(),
      this.reminderFieldName,
      this.removeTags,
    );
  }

  private setFieldValue(key: string, newValue: string): void {
    const field = this.firstField(key);
    if (field != null) {
      this.text = replaceFieldValue(this.text, field, newValue);
    } else {
      this.text = appendField(this.text, key, newValue, "bracket");
    }
  }

  private removeFieldByKey(key: string): void {
    const field = this.firstField(key);
    if (field != null) {
      this.text = removeField(this.text, field);
    }
  }
}

export class DataviewReminderFormat extends TasksLikeReminderFormat<DataviewReminderModel> {
  public static readonly instance = new DataviewReminderFormat();

  parseReminder(todo: Todo): DataviewReminderModel | null {
    const parsed = DataviewReminderModel.parse(
      todo.body,
      this.reminderFieldName(),
      this.removeTagsEnabled(),
    );
    if (!parsed.hasAnySourceField()) {
      return null;
    }
    return parsed;
  }

  private reminderFieldName(): string {
    return this.config.getParameter(
      ReminderFormatParameterKey.dataviewReminderFieldName,
    );
  }

  private removeTagsEnabled(): boolean {
    return this.config.getParameter(
      ReminderFormatParameterKey.removeTagsForTasksPlugin,
    );
  }

  protected override usesSeparateReminderDate(
    parsed: DataviewReminderModel,
  ): boolean {
    return parsed.hasReminderField();
  }

  newReminder(title: string, time: DateTime): DataviewReminderModel {
    const parsed = DataviewReminderModel.parse(
      title,
      this.reminderFieldName(),
      this.removeTagsEnabled(),
    );
    // Unlike the Reminder plugin's own format, the Dataview format never
    // inserts at a caret position within the title: fields are always
    // appended at the end of the line, so `insertAt` doesn't apply here.
    parsed.setTime(time);
    return parsed;
  }
}
