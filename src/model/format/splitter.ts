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
        if (ch[0] == null) {
            throw "ch mustn't be null";
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
        separateSymbolAndText = false,
        insertAt?: number): Token | null {
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
                const lastToken = this.tokens[this.tokens.length - 1]!;
                if (!this.isTokenEndsWithSpace(lastToken)) {
                    // last token doesn't end with space.  Append space to last token.
                    lastToken.text += ' ';
                }
            }
            if (insertAt == null) {
                this.tokens.push(token);
            } else {
                let index = 0
                let insertTokenIndex = -1;
                let tokenIndex = 0;
                for (const t of this.tokens) {
                    // first token is the title of the reminder.
                    // we shouldn't insert before the title.
                    const end = index + t.symbol.length + t.text.length;
                    if (tokenIndex > 0) {
                        if (end > insertAt){
                            insertTokenIndex = tokenIndex;
                            break;                        
                        }
                    }
                    index = end;
                    tokenIndex++;
                }
                if (insertTokenIndex == -1) {
                    this.tokens.push(token);
                } else {
                    this.tokens.splice(insertTokenIndex, 0, token)
                    if (insertTokenIndex < this.tokens.length - 1) {
                        token.text = token.text + ' ';
                    }
                }
            }            
            return token;
        }

        this.replaceTokenText(token, text, keepSpace);
        return token;
    }

    public length() {
        return this.tokens.length;
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

    public removeToken(symbol: Symbol) {
        this.tokens = this.tokens.filter(token => !symbol.isSymbol(token.symbol));
    }

    forEachTokens(consumer: (token: Token) => void) {
        this.tokens.forEach(consumer);
    }

    public rangeOfSymbol(symbol: Symbol): {start: number, end: number} | undefined {
        let index = 0
        for (const token of this.tokens){
            const end = index + token.symbol.length + token.text.length;
            if (symbol.isSymbol(token.symbol)) {
                return {
                    start: index,
                    end: end
                };
            }
            index = end;
        }
        return;
    }

    public join(): string {
        return this.tokens.map(t => t.symbol + t.text).join("");
    }
}

export function splitBySymbol(line: string, symbols: Array<Symbol>): Array<Token> {
    const chars = [...line];
    let text: string = "";
    let currentToken: Token | null = null;
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