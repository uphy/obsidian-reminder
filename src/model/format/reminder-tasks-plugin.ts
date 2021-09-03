import { DateTime } from "model/time";
import { splitBySymbol, Symbol, Tokens } from "./splitter";
import { ReminderFormat, ReminderEdit } from "./reminder-base";
import { Reminder } from "model/reminder";
import moment from "moment";

export class TasksPluginReminderLine {

    private static readonly dateFormat = "YYYY-MM-DD";
    private static readonly symbolDueDate = Symbol.ofChars([..."📅📆🗓"]);
    private static readonly symbolDoneDate = Symbol.ofChar("✅");
    private static readonly symbolRecurrence = Symbol.ofChar("🔁");
    private static readonly allSymbols = [
        TasksPluginReminderLine.symbolDueDate,
        TasksPluginReminderLine.symbolDoneDate,
        TasksPluginReminderLine.symbolRecurrence
    ];

    public static parse(line: string): TasksPluginReminderLine {
        return new TasksPluginReminderLine(new Tokens(splitBySymbol(line, this.allSymbols)));
    }

    private constructor(private tokens: Tokens) {
    }

    public getDescription(): string | null {
        return this.tokens.getTokenText("", true);
    }

    public setDescription(description: string) {
        this.tokens.setTokenText("", description, true, true);
    }

    public getDueDate(): DateTime | null {
        return this.getDate(TasksPluginReminderLine.symbolDueDate);
    }

    public getDoneDate(): DateTime | null {
        return this.getDate(TasksPluginReminderLine.symbolDoneDate);
    }

    public setDueDate(time: DateTime | string) {
        this.setDate(TasksPluginReminderLine.symbolDueDate, time);
    }

    public setDoneDate(time: DateTime | string) {
        this.setDate(TasksPluginReminderLine.symbolDoneDate, time);
    }

    private getDate(symbol: Symbol): DateTime | null {
        const dateText = this.tokens.getTokenText(symbol, true);
        if (dateText === null) {
            return null;
        }
        const date = moment(dateText, TasksPluginReminderLine.dateFormat, true);
        if (!date.isValid()) {
            return null;
        }
        return new DateTime(date, false);
    }

    private setDate(symbol: Symbol, time: DateTime | string) {
        let timeStr: string;
        if (time instanceof DateTime) {
            timeStr = time.format(TasksPluginReminderLine.dateFormat);
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

    public toLine(): string {
        return this.tokens.join();
    }
}

export class TasksPluginFormat implements ReminderFormat {

    public static readonly instance = new TasksPluginFormat();

    private constructor() { };

    parse(file: string, lineIndex: number, line: string): Reminder | null {
        const parsed = TasksPluginReminderLine.parse(line);
        if (parsed === null) {
            return null;
        }
        const dueDate = parsed.getDueDate();
        if (dueDate === null) {
            return null;
        }
        const description = parsed.getDescription();
        if (description === null) {
            return null;
        }

        return new Reminder(file, description, dueDate, lineIndex);
    }

    modify(line: string, edit: ReminderEdit): string | null {
        const parsed = TasksPluginReminderLine.parse(line);
        if (parsed === null) {
            return null;
        }
        if (edit.rawTime !== undefined) {
            parsed.setDueDate(edit.rawTime);
        } else if (edit.time !== undefined) {
            parsed.setDueDate(edit.time)
            parsed.setDoneDate(DateTime.now())
        }
        return parsed.toLine();
    }

}
