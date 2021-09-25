import assert from "assert";
import type { MarkdownDocument, Todo } from "model/format/markdown";
import { DateTime, DATE_TIME_FORMATTER } from "model/time";
import moment, { Moment } from "moment";
import { RRule } from "rrule";
import { ReminderEdit, ReminderFormatParameterKey, ReminderModel, TodoBasedReminderFormat } from "./reminder-base";
import { splitBySymbol, Symbol, Tokens } from "./splitter";

export class TasksPluginReminderModel implements ReminderModel {

    private static readonly dateFormat = "YYYY-MM-DD";
    private static readonly symbolDueDate = Symbol.ofChars([..."📅📆🗓"]);
    private static readonly symbolDoneDate = Symbol.ofChar("✅");
    private static readonly symbolRecurrence = Symbol.ofChar("🔁");
    private static readonly symbolReminder = Symbol.ofChar("⏰");
    private static readonly allSymbols = [
        TasksPluginReminderModel.symbolDueDate,
        TasksPluginReminderModel.symbolDoneDate,
        TasksPluginReminderModel.symbolRecurrence,
        TasksPluginReminderModel.symbolReminder,
    ];

    public static parse(line: string, useCustomEmoji?: boolean, strictDateFormat?: boolean): TasksPluginReminderModel {
        return new TasksPluginReminderModel(
            useCustomEmoji ?? false,
            strictDateFormat ?? true,
            new Tokens(splitBySymbol(line, this.allSymbols)));
    }

    private constructor(
        private useCustomEmoji: boolean,
        private strictDateFormat: boolean,
        private tokens: Tokens) {
    }

    getTitle(): string | null {
        return this.tokens.getTokenText("", true);
    }
    getTime(): DateTime | null {
        return this.getDate(this.getReminderSymbol());
    }
    setTime(time: DateTime): void {
        this.setDate(this.getReminderSymbol(), time);
    }
    getDueDate(): DateTime | null {
        return this.getDate(TasksPluginReminderModel.symbolDueDate);
    }
    setDueDate(time: DateTime): void {
        this.setDate(TasksPluginReminderModel.symbolDueDate, time);
    }
    setRawTime(rawTime: string): boolean {
        this.setDate(this.getReminderSymbol(), rawTime);
        return true;
    }
    private getReminderSymbol(): Symbol {
        if (this.useCustomEmoji) {
            return TasksPluginReminderModel.symbolReminder;
        } else {
            return TasksPluginReminderModel.symbolDueDate;
        }
    }
    toMarkdown(): string {
        return this.tokens.join();
    }

    setTitle(description: string) {
        this.tokens.setTokenText("", description, true, true);
    }

    getDoneDate(): DateTime | null {
        return this.getDate(TasksPluginReminderModel.symbolDoneDate);
    }

    setDoneDate(time: DateTime | string | undefined) {
        this.setDate(TasksPluginReminderModel.symbolDoneDate, time);
    }

    getRecurrence() {
        return this.tokens.getTokenText(TasksPluginReminderModel.symbolRecurrence, true);
    }

    clone(): TasksPluginReminderModel {
        return TasksPluginReminderModel.parse(this.toMarkdown(), this.useCustomEmoji, this.strictDateFormat);
    }

    private getDate(symbol: Symbol): DateTime | null {
        const dateText = this.tokens.getTokenText(symbol, true);
        if (dateText === null) {
            return null;
        }
        if (symbol === TasksPluginReminderModel.symbolReminder) {
            return DATE_TIME_FORMATTER.parse(dateText);
        } else {
            const date = moment(dateText, TasksPluginReminderModel.dateFormat, this.strictDateFormat);
            if (!date.isValid()) {
                return null;
            }
            return new DateTime(date, false);
        }
    }

    private setDate(symbol: Symbol, time: DateTime | string | undefined) {
        if (time == null) {
            this.tokens.removeToken(symbol);
            return;
        }
        let timeStr: string;
        if (time instanceof DateTime) {
            if (symbol === TasksPluginReminderModel.symbolReminder) {
                timeStr = DATE_TIME_FORMATTER.toString(time);
            } else {
                timeStr = time.format(TasksPluginReminderModel.dateFormat);
            }
        } else {
            timeStr = time;
        }

        this.tokens.setTokenText(symbol, timeStr, true, true, this.shouldSplitBetweenSymbolAndText());
    }

    private shouldSplitBetweenSymbolAndText(): boolean {
        let withSpace = 0;
        let noSpace = 0;
        this.tokens.forEachTokens(token => {
            if (token.symbol === '') {
                return;
            }
            if (token.text.match(/^\s.*$/)) {
                withSpace += 1;
            } else {
                noSpace++;
            }
        })
        if (withSpace > noSpace) {
            return true;
        } else if (withSpace < noSpace) {
            return false;
        } else {
            return true;
        }
    }
}

export class TasksPluginFormat extends TodoBasedReminderFormat<TasksPluginReminderModel> {

    public static readonly instance = new TasksPluginFormat();

    parseReminder(todo: Todo): TasksPluginReminderModel | null {
        const parsed = TasksPluginReminderModel.parse(todo.body, this.useCustomEmoji(), this.isStrictDateFormat());
        if (this.useCustomEmoji() && parsed.getDueDate() == null) {
            return null;
        }
        return parsed;
    }

    private useCustomEmoji() {
        return this.config.getParameter(ReminderFormatParameterKey.useCustomEmojiForTasksPlugin);
    }

    override modifyReminder(doc: MarkdownDocument, todo: Todo, parsed: TasksPluginReminderModel, edit: ReminderEdit): boolean {
        if (!super.modifyReminder(doc, todo, parsed, edit)) {
            return false;
        }
        if (edit.checked !== undefined) {
            if (edit.checked) {
                const recurrence = parsed.getRecurrence();
                if (recurrence !== null) {

                    const nextReminderTodo = todo.clone();
                    assert(nextReminderTodo != null);
                    const nextReminder = parsed.clone();
                    const dueDate = parsed.getDueDate();
                    if (dueDate == null) {
                        return false;
                    }

                    if (this.useCustomEmoji()) {
                        const time = parsed.getTime();
                        if (time == null) {
                            return false;
                        }
                        const nextTime: Date | undefined = this.nextDate(recurrence, time.moment());
                        const nextDueDate: Date | undefined = this.nextDate(recurrence, dueDate.moment());
                        if (nextTime == null || nextDueDate == null) {
                            return false;
                        }
                        nextReminder.setTime(new DateTime(moment(nextTime), true));
                        nextReminder.setDueDate(new DateTime(moment(nextDueDate), true));
                    } else {
                        const next: Date | undefined = this.nextDate(recurrence, dueDate.moment());
                        if (next == null) {
                            return false;
                        }
                        const nextDueDate = new DateTime(moment(next), true);
                        nextReminder.setTime(nextDueDate);
                    }
                    nextReminderTodo.body = nextReminder.toMarkdown();
                    nextReminderTodo.setChecked(false);
                    doc.insertTodo(todo.lineIndex, nextReminderTodo);
                }
                parsed.setDoneDate(this.config.getParameter(ReminderFormatParameterKey.now));
            } else {
                parsed.setDoneDate(undefined);
            }
        }
        return true;
    }

    private nextDate(recurrence: string, dtStart: Moment): Date | undefined {
        const rruleOptions = RRule.parseText(recurrence);
        if (!rruleOptions) {
            return undefined;
        }

        const today = this.config.getParameter(ReminderFormatParameterKey.now).moment();
        today.set("hour", dtStart.get("hour"));
        today.set("minute", dtStart.get("minute"));
        today.set("second", dtStart.get("second"));
        today.set("millisecond", dtStart.get("millisecond"));
        if (today.isAfter(dtStart)) {
            dtStart = today;
        }

        rruleOptions.dtstart = dtStart.toDate();

        const rrule = new RRule(rruleOptions);
        return rrule.after(dtStart.toDate(), false);
    }

    newReminder(title: string, time: DateTime): TasksPluginReminderModel {
        const parsed = TasksPluginReminderModel.parse(title, this.useCustomEmoji(), this.isStrictDateFormat());
        parsed.setTime(time);
        if (this.useCustomEmoji() && parsed.getDueDate() == null) {
            parsed.setDueDate(time);
        }
        parsed.setTitle(title);
        return parsed;
    }

}