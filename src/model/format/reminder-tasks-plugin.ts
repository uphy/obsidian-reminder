import type { MarkdownDocument, Todo } from 'model/format/markdown';
import { DATE_TIME_FORMATTER, DateTime } from 'model/time';
import moment, { Moment } from 'moment';
import { RRule } from 'rrule';
import { ReminderEdit, ReminderFormatParameterKey, ReminderModel, TodoBasedReminderFormat } from './reminder-base';
import { TasksPluginSymbols } from './reminder-tasks-plugin-symbols';
import { Symbol, Tokens, splitBySymbol } from './splitter';

function removeTags(text: string): string {
    return text.replace(/#\w+/g, '');
}
export class TasksPluginReminderModel implements ReminderModel {
    private static readonly dateFormat = 'YYYY-MM-DD';

    public static parse(
        line: string,
        reminderSymbol: Symbol,
        removeTags?: boolean,
        strictDateFormat?: boolean,
    ): TasksPluginReminderModel {
        return new TasksPluginReminderModel(
            reminderSymbol,
            removeTags ?? false,
            strictDateFormat ?? true,
            new Tokens(splitBySymbol(line, TasksPluginSymbols.allSymbols)),
        );
    }

    private constructor(
        private reminderSymbol: Symbol,
        private removeTags: boolean,
        private strictDateFormat: boolean,
        private tokens: Tokens,
    ) {}

    getTitle(): string | null {
        let title = this.tokens.getTokenText('', true);
        if (title != null && this.removeTags) {
            title = removeTags(title);
        }
        return title;
    }
    getTime(): DateTime | null {
        return this.getDate(this.reminderSymbol);
    }
    setTime(time: DateTime, insertAt?: number): void {
        if (this.reminderSymbol == TasksPluginSymbols.reminder) {
            this.setDate(this.reminderSymbol, time, 1);
        } else {
            this.setDate(this.reminderSymbol, time, insertAt);
        }
    }
    getDueDate(): DateTime | null {
        return this.getDate(TasksPluginSymbols.dueDate);
    }
    setDueDate(time: DateTime): void {
        this.setDate(TasksPluginSymbols.dueDate, time);
    }
    setRawTime(rawTime: string): boolean {
        this.setDate(this.reminderSymbol, rawTime);
        return true;
    }
    getEndOfTimeTextIndex(): number {
        // get the end of the string index of due date or reminder date
        const token = this.tokens.rangeOfSymbol(this.reminderSymbol);
        if (token != null) {
            return token.end;
        }
        return this.toMarkdown().length;
    }

    toMarkdown(): string {
        return this.tokens.join();
    }

    setTitle(description: string) {
        this.tokens.setTokenText('', description, true, true);
    }

    getDoneDate(): DateTime | null {
        return this.getDate(TasksPluginSymbols.doneDate);
    }

    setDoneDate(time: DateTime | string | undefined) {
        this.setDate(TasksPluginSymbols.doneDate, time);
    }

    getRecurrence() {
        return this.tokens.getTokenText(TasksPluginSymbols.recurrence, true);
    }

    clone(): TasksPluginReminderModel {
        return TasksPluginReminderModel.parse(
            this.toMarkdown(),
            this.reminderSymbol,
            this.removeTags,
            this.strictDateFormat,
        );
    }

    private getDate(symbol: Symbol): DateTime | null {
        const dateText = this.tokens.getTokenText(symbol, true);
        if (dateText === null) {
            return null;
        }
        if (symbol === TasksPluginSymbols.reminder) {
            return DATE_TIME_FORMATTER.parse(dateText);
        } else {
            const date = moment(dateText, TasksPluginReminderModel.dateFormat, this.strictDateFormat);
            if (!date.isValid()) {
                return null;
            }
            return new DateTime(date, false);
        }
    }

    private setDate(symbol: Symbol, time: DateTime | string | undefined, insertAt?: number) {
        if (time == null) {
            this.tokens.removeToken(symbol);
            return;
        }
        let timeStr: string;
        if (time instanceof DateTime) {
            if (symbol === TasksPluginSymbols.reminder) {
                timeStr = DATE_TIME_FORMATTER.toString(time);
            } else {
                timeStr = time.format(TasksPluginReminderModel.dateFormat);
            }
        } else {
            timeStr = time;
        }
        this.tokens.setTokenText(symbol, timeStr, true, true, this.shouldSplitBetweenSymbolAndText(), insertAt);
    }

    private shouldSplitBetweenSymbolAndText(): boolean {
        let withSpace = 0;
        let noSpace = 0;
        this.tokens.forEachTokens((token) => {
            if (token.symbol === '') {
                return;
            }
            if (token.text.match(/^\s.*$/)) {
                withSpace += 1;
            } else {
                noSpace++;
            }
        });
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
        const parsed = TasksPluginReminderModel.parse(
            todo.body,
            this.reminderEmojiSymbol(),
            this.removeTagsEnabled(),
            this.isStrictDateFormat(),
        );
        if (this.useCustomEmoji() && parsed.getDueDate() == null) {
            return null;
        }
        return parsed;
    }

    private removeTagsEnabled() {
        return this.config.getParameter(ReminderFormatParameterKey.removeTagsForTasksPlugin);
    }

    private useCustomEmoji() {
        return this.config.getParameter(ReminderFormatParameterKey.useCustomEmojiForTasksPlugin);
    }

    private reminderEmojiSymbol() {
        return this.config.getParameter(ReminderFormatParameterKey.tasksPluginEmoji);
    }

    override modifyReminder(
        doc: MarkdownDocument,
        todo: Todo,
        parsed: TasksPluginReminderModel,
        edit: ReminderEdit,
    ): boolean {
        if (!super.modifyReminder(doc, todo, parsed, edit)) {
            return false;
        }
        if (edit.checked !== undefined) {
            if (edit.checked) {
                const recurrence = parsed.getRecurrence();
                if (recurrence !== null) {
                    const nextReminderTodo = todo.clone()!;
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
        today.set('hour', dtStart.get('hour'));
        today.set('minute', dtStart.get('minute'));
        today.set('second', dtStart.get('second'));
        today.set('millisecond', dtStart.get('millisecond'));
        if (today.isAfter(dtStart)) {
            dtStart = today;
        }

        // clone dtStart because dtStart will be modified by utc() call.
        const base = dtStart.clone();

        // process rrule
        rruleOptions.dtstart = dtStart.utc(true).toDate();
        const rrule = new RRule(rruleOptions);
        const rdate = rrule.after(dtStart.toDate(), false);

        // apply rrule to `base`
        const diff = rdate.getTime() - rruleOptions.dtstart.getTime();
        base.add(diff, 'millisecond');
        return base.toDate();
    }

    newReminder(title: string, time: DateTime, insertAt?: number): TasksPluginReminderModel {
        const parsed = TasksPluginReminderModel.parse(
            title,
            this.reminderEmojiSymbol(),
            this.removeTagsEnabled(),
            this.isStrictDateFormat(),
        );
        parsed.setTime(time, insertAt);
        if (this.useCustomEmoji() && parsed.getDueDate() == null) {
            parsed.setDueDate(time);
        }
        parsed.setTitle(title);
        return parsed;
    }
}
