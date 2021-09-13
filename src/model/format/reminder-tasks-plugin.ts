import { DateTime, DATE_TIME_FORMATTER } from "model/time";
import { splitBySymbol, Symbol, Tokens } from "./splitter";
import { ReminderModel, TodoBasedReminderFormat, ReminderEdit, ReminderFormatParameterKey } from "./reminder-base";
import { MarkdownDocument, Todo } from "model/format/markdown";
import moment, { Moment } from "moment";
import { RRule } from "rrule";

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

    public static parse(line: string, useCustomEmoji?: boolean): TasksPluginReminderModel {
        if (useCustomEmoji == null) {
            useCustomEmoji = false;
        }
        return new TasksPluginReminderModel(useCustomEmoji, new Tokens(splitBySymbol(line, this.allSymbols)));
    }

    private constructor(private useCustomEmoji: boolean, private tokens: Tokens) {
    }

    getTitle(): string {
        return this.tokens.getTokenText("", true);
    }
    getTime(): DateTime {
        return this.getDate(this.getReminderSymbol());
    }
    setTime(time: DateTime): void {
        this.setDate(this.getReminderSymbol(), time);
    }
    getDueDate(): DateTime {
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

    setDoneDate(time: DateTime | string) {
        this.setDate(TasksPluginReminderModel.symbolDoneDate, time);
    }

    getRecurrence() {
        return this.tokens.getTokenText(TasksPluginReminderModel.symbolRecurrence, true);
    }

    clone(): TasksPluginReminderModel {
        return TasksPluginReminderModel.parse(this.toMarkdown(), this.useCustomEmoji);
    }

    private getDate(symbol: Symbol): DateTime | null {
        const dateText = this.tokens.getTokenText(symbol, true);
        if (dateText === null) {
            return null;
        }
        if (symbol === TasksPluginReminderModel.symbolReminder) {
            return DATE_TIME_FORMATTER.parse(dateText);
        } else {
            const date = moment(dateText, TasksPluginReminderModel.dateFormat, true);
            if (!date.isValid()) {
                return null;
            }
            return new DateTime(date, false);
        }
    }

    private setDate(symbol: Symbol, time: DateTime | string) {
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

    parseReminder(todo: Todo): TasksPluginReminderModel {
        return TasksPluginReminderModel.parse(todo.body, this.useCustomEmoji());
    }

    private useCustomEmoji() {
        return this.config.getParameter(ReminderFormatParameterKey.useCustomEmojiForTasksPlugin);
    }

    modifyReminder(doc: MarkdownDocument, todo: Todo, parsed: TasksPluginReminderModel, edit: ReminderEdit): boolean {
        if (!super.modifyReminder(doc, todo, parsed, edit)) {
            return false;
        }
        if (edit.checked !== undefined && edit.checked) {
            const recurrence = parsed.getRecurrence();
            if (recurrence !== null) {

                const nextReminderTodo = todo.clone();
                const nextReminder = parsed.clone();
                if (this.useCustomEmoji()) {
                    const nextTime: Date = this.nextDate(recurrence, parsed.getTime().moment());
                    const nextDueDate: Date = this.nextDate(recurrence, parsed.getDueDate().moment());
                    nextReminder.setTime(new DateTime(moment(nextTime), true));
                    nextReminder.setDueDate(new DateTime(moment(nextDueDate), true));
                } else {
                    const next: Date = this.nextDate(recurrence, parsed.getDueDate().moment());
                    const nextDueDate = new DateTime(moment(next), true);
                    nextReminder.setTime(nextDueDate);
                }
                nextReminderTodo.body = nextReminder.toMarkdown();
                nextReminderTodo.setChecked(false);
                doc.insertTodo(todo.lineIndex, nextReminderTodo);
            }
            parsed.setDoneDate(this.config.getParameter(ReminderFormatParameterKey.now));
        }
        return true;
    }

    private nextDate(recurrence: string, dtStart: Moment) {
        const rruleOptions = RRule.parseText(recurrence);

        const today = this.config.getParameter(ReminderFormatParameterKey.now).moment();
        today.set("hour", dtStart.get("hour"));
        today.set("minute", dtStart.get("minute"));
        today.set("second", dtStart.get("second"));
        today.set("millisecond", dtStart.get("millisecond"));
        if(today.isAfter(dtStart)){
            dtStart = today;
        }

        rruleOptions.dtstart = dtStart.toDate();
        
        const rrule = new RRule(rruleOptions);
        return rrule.after(dtStart.toDate(), false);
    }

    newReminder(title: string, time: DateTime): TasksPluginReminderModel {
        const parsed = TasksPluginReminderModel.parse(title, this.useCustomEmoji());
        parsed.setTime(time);
        parsed.setTitle(title);
        return parsed;
    }

}