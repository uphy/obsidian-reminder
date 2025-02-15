import { Symbol, Tokens, splitBySymbol } from "./splitter";

describe("Symbol", (): void => {
  test("ofChar()", (): void => {
    const s = Symbol.ofChar("🔁");
    expect(s.isSymbol("🔁")).toBe(true);
    expect(s.isSymbol("a")).toBe(false);
  });
  test("ofChars()", (): void => {
    const s = Symbol.ofChars([..."📅📆🗓"]);
    expect(s.isSymbol("📅")).toBe(true);
    expect(s.isSymbol("📆")).toBe(true);
    expect(s.isSymbol("🗓")).toBe(true);
    expect(s.isSymbol("a")).toBe(false);
  });
});

const symbolOf = (symbols: string) => {
  return [Symbol.ofChars([...symbols])];
};

describe("splitBySymbol()", (): void => {
  test("basic", (): void => {
    expect(
      splitBySymbol(
        "this is a title #tag1 #tag2 🔁every hour📅2021-09-08 ✅2021-08-31",
        symbolOf("#📅📆🗓✅🔁"),
      ),
    ).toStrictEqual([
      { symbol: "", text: "this is a title " },
      { symbol: "#", text: "tag1 " },
      { symbol: "#", text: "tag2 " },
      { symbol: "🔁", text: "every hour" },
      { symbol: "📅", text: "2021-09-08 " },
      { symbol: "✅", text: "2021-08-31" },
    ]);
  });
  test("no symbols", (): void => {
    expect(
      splitBySymbol("this is a title", symbolOf("📅📆🗓✅🔁")),
    ).toStrictEqual([{ symbol: "", text: "this is a title" }]);
  });
});

describe("Tokens", (): void => {
  test("setTokenText()", (): void => {
    const tokens = new Tokens([
      { symbol: "A", text: "text1" },
      { symbol: "B", text: " text2" },
      { symbol: "C", text: "text3 " },
      { symbol: "D", text: " text4 " },
      { symbol: "E", text: "  text5  " },
      { symbol: "", text: " text6 " },
    ]);
    expect(tokens.setTokenText("A", "text1'", true, true)).toEqual({
      symbol: "A",
      text: "text1'",
    });
    expect(tokens.setTokenText("B", "text2'", true, true)).toEqual({
      symbol: "B",
      text: " text2'",
    });
    expect(tokens.setTokenText("B", "text2'", false, true)).toEqual({
      symbol: "B",
      text: "text2'",
    });
    expect(tokens.setTokenText("C", "text3'", true, true)).toEqual({
      symbol: "C",
      text: "text3' ",
    });
    expect(tokens.setTokenText("C", "text3'", false, true)).toEqual({
      symbol: "C",
      text: "text3'",
    });
    expect(tokens.setTokenText("D", "text4'", true, true)).toEqual({
      symbol: "D",
      text: " text4' ",
    });
    expect(tokens.setTokenText("D", "text4'", false, true)).toEqual({
      symbol: "D",
      text: "text4'",
    });
    expect(tokens.setTokenText("E", "text5'", true, true)).toEqual({
      symbol: "E",
      text: "  text5'  ",
    });
    expect(tokens.setTokenText("E", "text5'", false, true)).toEqual({
      symbol: "E",
      text: "text5'",
    });
    expect(tokens.setTokenText("", "text6'", true, true)).toEqual({
      symbol: "",
      text: " text6' ",
    });
    expect(tokens.setTokenText("", "text6'", false, true)).toEqual({
      symbol: "",
      text: "text6'",
    });
  });
  test("setTokenText() create=true", (): void => {
    const tokens = new Tokens([{ symbol: "A", text: "text1 " }]);
    tokens.setTokenText("B", "text2", true, true);
    expect(tokens.join()).toBe("Atext1 Btext2");
  });
  test("getTokenText()", (): void => {
    const tokens = new Tokens([{ symbol: "A", text: "  hello world  " }]);

    expect(tokens.getTokenText("A", false)).toBe("  hello world  ");
    expect(tokens.getTokenText("B", false)).toBe(null);

    expect(tokens.getTokenText("A", true)).toBe("hello world");
    expect(tokens.getTokenText("B", true)).toBe(null);
  });
  test("setTokenText() create=true appending space", (): void => {
    const tokens = new Tokens([{ symbol: "A", text: "text1" }]);
    tokens.setTokenText("B", "text2", true, true);
    expect(tokens.join()).toBe("Atext1 Btext2");
  });
  test("remove()", (): void => {
    const tokens = new Tokens([
      { symbol: "A", text: "text1" },
      { symbol: "B", text: "text2" },
      { symbol: "C", text: "text3" },
    ]);
    tokens.removeToken(Symbol.ofChar("B"));
    expect(tokens.join()).toBe("Atext1Ctext3");
  });
  test("join", (): void => {
    expect(
      new Tokens([
        { symbol: "A", text: "text1" },
        { symbol: "B", text: " text2" },
        { symbol: "C", text: "text3 " },
        { symbol: "D", text: " text4 " },
        { symbol: "", text: " text5 " },
      ]).join(),
    ).toEqual("Atext1B text2Ctext3 D text4  text5 ");
  });
});
