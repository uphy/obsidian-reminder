import { DateTime } from "model/time";
import { splitBySymbol, Symbol, Tokens } from "./splitter";
import { ReminderModel, TodoBasedReminderFormat, ReminderEdit } from "./reminder-base";
import moment from "moment";
import { Todo } from "./markdown";

export class TasksPluginReminderModel implements ReminderModel {

    private static readonly dateFormat = "YYYY-MM-DD";
    private static readonly symbolDueDate = Symbol.ofChars([..."📅📆🗓"]);
    private static readonly symbolDoneDate = Symbol.ofChar("✅");
    private static readonly symbolRecurrence = Symbol.ofChar("🔁");
    private static readonly allSymbols = [
        TasksPluginReminderModel.symbolDueDate,
        TasksPluginReminderModel.symbolDoneDate,
        TasksPluginReminderModel.symbolRecurrence
    ];

    public static parse(line: string): TasksPluginReminderModel {
        return new TasksPluginReminderModel(new Tokens(splitBySymbol(line, this.allSymbols)));
    }

    private constructor(private tokens: Tokens) {
    }

    getTitle(): string {
        return this.tokens.getTokenText("", true);
    }
    getTime(): DateTime {
        return this.getDate(TasksPluginReminderModel.symbolDueDate);
    }
    setTime(time: DateTime): void {
        this.setDate(TasksPluginReminderModel.symbolDueDate, time);
    }
    setRawTime(rawTime: string): boolean {
        this.setDate(TasksPluginReminderModel.symbolDueDate, rawTime);
        return true;
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

    private getDate(symbol: Symbol): DateTime | null {
        const dateText = this.tokens.getTokenText(symbol, true);
        if (dateText === null) {
            return null;
        }
        const date = moment(dateText, TasksPluginReminderModel.dateFormat, true);
        if (!date.isValid()) {
            return null;
        }
        return new DateTime(date, false);
    }

    private setDate(symbol: Symbol, time: DateTime | string) {
        let timeStr: string;
        if (time instanceof DateTime) {
            timeStr = time.format(TasksPluginReminderModel.dateFormat);
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
        return TasksPluginReminderModel.parse(todo.body);
    }

    modifyReminder(todo: Todo, parsed: TasksPluginReminderModel, edit: ReminderEdit): boolean {
        if (!super.modifyReminder(todo, parsed, edit)) {
            return false;
        }
        if (edit.checked !== undefined && edit.checked) {
            parsed.setDoneDate(DateTime.now());
        }
        return true;
    }

}
