export type Token = {
  symbol: string;
  text: string;
};

export class Symbol {
  static ofChar(ch: string): Symbol {
    return new Symbol(ch, (text) => {
      return text === ch;
    });
  }

  static ofChars(ch: Array<string>): Symbol {
    if (ch.length === 0) {
      throw new Error("empty symbol");
    }
    if (ch[0] == null) {
      throw new Error("ch mustn't be null");
    }
    if (ch.length === 0) {
      return this.ofChar(ch[0]);
    }
    return new Symbol(ch[0], (text) => {
      return ch.filter((c) => text === c).length > 0;
    });
  }

  private constructor(
    public primary: string,
    private func: (text: string) => boolean,
  ) {}

  isSymbol(text: string) {
    return this.func(text);
  }
}

export class Tokens {
  constructor(private tokens: Array<Token>) {}

  public setTokenText(
    symbol: Symbol | string,
    text: string,
    keepSpace = false,
    create = false,
    separateSymbolAndText = false,
    insertAt?: number,
    prefer?: (token: Token) => boolean,
  ): Token | null {
    let token = this.getToken(symbol, prefer);
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
      if (
        separateSymbolAndText &&
        token.symbol !== "" &&
        !token.text.startsWith(" ")
      ) {
        token.text = " " + token.text;
      }

      if (this.tokens.length > 0) {
        const lastToken = this.tokens[this.tokens.length - 1]!;
        if (!this.isTokenEndsWithSpace(lastToken)) {
          // last token doesn't end with space.  Append space to last token.
          lastToken.text += " ";
        }
      }
      if (insertAt == null) {
        this.tokens.push(token);
      } else {
        let index = 0;
        let insertTokenIndex = -1;
        let tokenIndex = 0;
        for (const t of this.tokens) {
          // first token is the title of the reminder.
          // we shouldn't insert before the title.
          const end = index + t.symbol.length + t.text.length;
          if (tokenIndex > 0) {
            if (end > insertAt) {
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
          this.tokens.splice(insertTokenIndex, 0, token);
          if (insertTokenIndex < this.tokens.length - 1) {
            token.text = token.text + " ";
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

  /**
   * When a symbol occurs more than once, `prefer` picks among the matches:
   * the LAST satisfying token wins, because the Tasks plugin reads fields
   * from the end of the line — so with two candidates the later one is the
   * real field and the earlier one is description. When no token satisfies
   * `prefer` (or none is given), this falls back to the first match, which
   * is the historical behavior for every single-token line.
   */
  public getToken(
    symbol: Symbol | string,
    prefer?: (token: Token) => boolean,
  ): Token | null {
    let first: Token | null = null;
    let preferred: Token | null = null;
    for (const token of this.tokens) {
      const matches =
        symbol instanceof Symbol
          ? symbol.isSymbol(token.symbol)
          : symbol === token.symbol;
      if (!matches) {
        continue;
      }
      if (first === null) {
        first = token;
      }
      if (prefer != null && prefer(token)) {
        preferred = token;
      }
    }
    return preferred ?? first;
  }

  public getTokenText(
    symbol: Symbol | string,
    removeSpace = false,
    prefer?: (token: Token) => boolean,
  ): string | null {
    const token = this.getToken(symbol, prefer);
    if (token === null) {
      return null;
    }
    if (!removeSpace) {
      return token.text;
    }
    return token.text.replace(/^\s*(.*?)\s*$/, "$1");
  }

  public removeToken(symbol: Symbol) {
    this.tokens = this.tokens.filter((token) => !symbol.isSymbol(token.symbol));
  }

  forEachTokens(consumer: (token: Token) => void) {
    this.tokens.forEach(consumer);
  }

  public rangeOfSymbol(
    symbol: Symbol,
    prefer?: (token: Token) => boolean,
  ): { start: number; end: number } | undefined {
    const target = this.getToken(symbol, prefer);
    if (target === null) {
      return;
    }
    let index = 0;
    for (const token of this.tokens) {
      const end = index + token.symbol.length + token.text.length;
      if (token === target) {
        return {
          start: index,
          end: end,
        };
      }
      index = end;
    }
    return;
  }

  public join(): string {
    return this.tokens.map((t) => t.symbol + t.text).join("");
  }
}

/**
 * Marks the characters covered by an inline code span, backticks included.
 *
 * CommonMark closes a run of N backticks with the *next* run of exactly N, and
 * an opening run that is never closed is literal text rather than a span. That
 * is why this pre-scans the line instead of toggling a flag while walking it: a
 * toggle would treat "Task ` unclosed 📅 2021-09-08" as being inside a span and
 * silently drop a real symbol, changing lines that parse correctly today.
 */
function inlineCodeSpanMask(chars: Array<string>): Array<boolean> {
  const masked = new Array<boolean>(chars.length).fill(false);
  let i = 0;
  while (i < chars.length) {
    if (chars[i] !== "`") {
      i++;
      continue;
    }
    const openStart = i;
    while (i < chars.length && chars[i] === "`") {
      i++;
    }
    const runLength = i - openStart;

    let j = i;
    let closed = false;
    while (j < chars.length) {
      if (chars[j] !== "`") {
        j++;
        continue;
      }
      const closeStart = j;
      while (j < chars.length && chars[j] === "`") {
        j++;
      }
      if (j - closeStart === runLength) {
        for (let k = openStart; k < j; k++) {
          masked[k] = true;
        }
        closed = true;
        break;
      }
    }
    // When no closing run exists, `i` already sits just past the opening run,
    // so scanning resumes there and the backticks stay ordinary text.
    if (closed) {
      i = j;
    }
  }
  return masked;
}

export function splitBySymbol(
  line: string,
  symbols: Array<Symbol>,
): Array<Token> {
  const chars = [...line];
  // A marker written inside an inline code span is prose *about* a marker, not
  // a marker. #338 established the same rule for fenced blocks in
  // MarkdownDocument.parse, which skips whole lines and so never sees this case.
  const inCodeSpan = inlineCodeSpanMask(chars);
  let text: string = "";
  let currentToken: Token | null = null;
  const splitted: Array<Token> = [];

  const fillPreviousToken = () => {
    if (currentToken === null) {
      // previous token
      splitted.push({ symbol: "", text });
    } else {
      // previous token
      currentToken.text = text;
    }
  };
  chars.forEach((c, index) => {
    const isSymbol =
      !inCodeSpan[index] && symbols.filter((s) => s.isSymbol(c)).length > 0;
    if (isSymbol) {
      fillPreviousToken();

      // new token
      currentToken = { symbol: c, text: "" };
      splitted.push(currentToken);
      text = "";
    } else if (
      currentToken !== null &&
      c === "#" &&
      (text.length === 0 || /\s$/.test(text))
    ) {
      // A tag ("#...") that starts a new word inside a symbol token's text
      // (e.g. the due date "📅 2021-09-08 #mytag") must not be absorbed into
      // that token: otherwise later edits to the symbol token (e.g. changing
      // the date) would silently delete the tag. Close the current symbol
      // token here and start a new plain-text ("") token that the tag (and
      // anything after it, up to the next symbol) will belong to.
      //
      // The code-span mask deliberately does not reach this branch: a tag is
      // not a reminder marker, and masking `#` inside a span would re-absorb
      // the tag into the symbol token — the exact loss this split prevents.
      fillPreviousToken();
      currentToken = null;
      text = c;
    } else {
      text += c;
    }
  });
  if (text.length > 0) {
    fillPreviousToken();
  }
  return splitted;
}
