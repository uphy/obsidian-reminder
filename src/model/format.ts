import moment from "moment";
import { Reminder } from "./reminder";
import { DateTime, DATE_TIME_FORMATTER } from "./time";

export type ReminderEdit = {
    time?: DateTime,
    rawTime?: string
}

export interface ReminderFormat {
    /**
     * Parse given line if possible.
     * 
     * @param file file path
     * @param lineIndex line index
     * @param line line to parse
     * @returns parsed reminder.  If the line cannot be parsed, returns null
     */
    parse(file: string, lineIndex: number, line: string): Reminder | null
    /**
     * Modify the given line if possible.
     * 
     * @param line line to parse
     * @param edit defines how to edit
     * @returns modified line.  If the line cannot be parsed, returns null
     */
    modify(line: string, edit: ReminderEdit): string | null;
}

class DefaultReminderLine {
    constructor(
        public title1: string,
        public time: string,
        public title2: string
    ) { }

    toLine(): string {
        return `${this.title1}(@${this.time})${this.title2}`;
    }
}

export class DefaultReminderFormat implements ReminderFormat {

    public static readonly instance = new DefaultReminderFormat();

    private static reminderRegexp = /^(?<title1>.*?)\(@(?<time>.+?)\)(?<title2>.*)$/;

    private constructor() { }

    parse(file: string, lineIndex: number, line: string): Reminder | null {
        const parsed = this.parseReminderLine(line);
        if (parsed === null) {
            return null;
        }

        const title = `${parsed.title1.trim()} ${parsed.title2.trim()}`.trim();
        const parsedTime = DATE_TIME_FORMATTER.parse(parsed.time);
        if (parsedTime !== null) {
            return new Reminder(file, title, parsedTime, lineIndex);
        }
        return null;
    }

    modify(line: string, edit: ReminderEdit): string {
        const r = this.parseReminderLine(line);
        if (r === null) {
            return null;
        }
        if (edit.rawTime !== undefined) {
            r.time = edit.rawTime;
        } else if (edit.time !== undefined) {
            r.time = DATE_TIME_FORMATTER.toString(edit.time);
        }
        return r.toLine();
    }

    private parseReminderLine(line: string): DefaultReminderLine | null {
        const result = DefaultReminderFormat.reminderRegexp.exec(line);
        if (result === null) {
            return null;
        }
        const title1 = result.groups.title1;
        const time = result.groups.time;
        const title2 = result.groups.title2;
        return new DefaultReminderLine(title1, time, title2);
    }

}

export type Token = {
    symbol: string,
    text: string
}

export class Symbol {

    static ofChar(ch: string): Symbol {
        return new Symbol(ch, text => {
            return text === ch;
        });
    }

    static ofChars(ch: Array<string>): Symbol {
        if (ch.length === 0) {
            throw "empty symbol";
        }
        if (ch.length === 0) {
            return this.ofChar(ch[0]);
        }
        return new Symbol(ch[0], text => {
            return ch.filter(c => text === c).length > 0;
        });
    }

    private constructor(public primary: string, private func: (text: string) => boolean) { }

    isSymbol(text: string) {
        return this.func(text);
    };
}

export class Tokens {
    constructor(private tokens: Array<Token>) { }

    public setTokenText(
        symbol: Symbol | string,
        text: string,
        keepSpace = false,
        create = false,
        separateSymbolAndText = false): Token | null {
        let token = this.getToken(symbol);
        if (token === null) {
            if (!create) {
                return null;
            }
            // append new token
            if (symbol instanceof Symbol) {
                token = { symbol: symbol.primary, text };
            } else {
                token = { symbol, text };
            }
            if (separateSymbolAndText && token.symbol !== '' && !token.text.startsWith(" ")) {
                token.text = ' ' + token.text;
            }

            if (this.tokens.length > 0) {
                const lastToken = this.tokens[this.tokens.length - 1];
                if (!this.isTokenEndsWithSpace(lastToken)) {
                    // last token doesn't end with space.  Append space to last token.
                    lastToken.text += ' ';
                }
            }
            this.tokens.push(token);
            return token;
        }

        this.replaceTokenText(token, text, keepSpace);
        return token;
    }

    private replaceTokenText(token: Token, text: string, keepSpace = false) {
        if (!keepSpace) {
            token.text = text;
            return;
        }

        token.text = token.text.replace(/^(\s*).*?(\s*)$/, `$1${text}$2`);
    }

    private isTokenEndsWithSpace(token: Token) {
        return token.text.match(/^.*\s$/);
    }

    public getToken(symbol: Symbol | string): Token | null {
        for (let token of this.tokens) {
            if (symbol instanceof Symbol) {
                if (symbol.isSymbol(token.symbol)) {
                    return token;
                }
            } else {
                if (symbol === token.symbol) {
                    return token;
                }
            }
        }
        return null;
    }

    public getTokenText(symbol: Symbol | string, removeSpace = false): string | null {
        const token = this.getToken(symbol);
        if (token === null) {
            return null;
        }
        if (!removeSpace) {
            return token.text;
        }
        return token.text.replace(/^\s*(.*?)\s*$/, `$1`);
    }

    forEachTokens(consumer: (token: Token) => void) {
        this.tokens.forEach(consumer);
    }

    public join(): string {
        return this.tokens.map(t => t.symbol + t.text).join("");
    }
}

export function splitBySymbol(line: string, symbols: Array<Symbol>): Array<Token> {
    const chars = [...line];
    let text: string = "";
    let currentToken: Token = null;
    const splitted: Array<Token> = [];

    const fillPreviousToken = () => {
        if (currentToken === null) {
            // previous token
            splitted.push({ symbol: '', text });
        } else {
            // previous token
            currentToken.text = text;
        }
    }
    chars.forEach(c => {
        let isSymbol = symbols.filter(s => s.isSymbol(c)).length > 0;
        if (isSymbol) {
            fillPreviousToken();

            // new token
            currentToken = { symbol: c, text: '' };
            splitted.push(currentToken);
            text = '';
        } else {
            text += c;
        }
    });
    if (text.length > 0) {
        fillPreviousToken();
    }
    return splitted;
}

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

class CompositeReminderFormat implements ReminderFormat {
    private formats: Array<ReminderFormat> = [];

    resetFormat(formats: Array<ReminderFormat>) {
        this.formats = formats;
    }

    parse(file: string, lineIndex: number, line: string): Reminder | null {
        for (const formatter of this.formats) {
            const parsed = formatter.parse(file, lineIndex, line);
            if (parsed !== null) {
                return parsed;
            }
        }
        return null;
    }
    modify(line: string, edit: ReminderEdit): string | null {
        for (const formatter of this.formats) {
            const modified = formatter.modify(line, edit);
            if (modified !== null) {
                return modified;
            }
        }
        return null;
    }
}

const reminderFormat = new CompositeReminderFormat();
reminderFormat.resetFormat([DefaultReminderFormat.instance, TasksPluginFormat.instance]);
export const REMINDER_FORMAT = reminderFormat;