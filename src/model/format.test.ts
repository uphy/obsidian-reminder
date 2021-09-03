import { splitBySymbol, Symbol, TasksPluginReminderLine, Tokens } from "./format";
import { DateTime } from "./time";
import moment from "moment";

describe('Symbol', (): void => {
    test('ofChar()', (): void => {
        const s = Symbol.ofChar("🔁");
        expect(s.isSymbol("🔁")).toBe(true);
        expect(s.isSymbol("a")).toBe(false);
    });
    test('ofChars()', (): void => {
        const s = Symbol.ofChars([..."📅📆🗓"]);
        expect(s.isSymbol("📅")).toBe(true);
        expect(s.isSymbol("📆")).toBe(true);
        expect(s.isSymbol("🗓")).toBe(true);
        expect(s.isSymbol("a")).toBe(false);
    });
});

const symbolOf = (symbols: string) => {
    return [Symbol.ofChars([...symbols])];
}

describe('splitBySymbol()', (): void => {
    test('basic', (): void => {
        expect(splitBySymbol("this is a title #tag1 #tag2 🔁every hour📅2021-09-08 ✅2021-08-31", symbolOf("#📅📆🗓✅🔁")))
            .toStrictEqual([
                { symbol: "", text: "this is a title " },
                { symbol: "#", text: "tag1 " },
                { symbol: "#", text: "tag2 " },
                { symbol: "🔁", text: "every hour" },
                { symbol: "📅", text: "2021-09-08 " },
                { symbol: "✅", text: "2021-08-31" },
            ]);
    });
    test('no symbols', (): void => {
        expect(splitBySymbol("this is a title", symbolOf("📅📆🗓✅🔁")))
            .toStrictEqual([
                { symbol: "", text: "this is a title" },
            ]);
    });

});

describe('Tokens', (): void => {
    test('setTokenText()', (): void => {
        const tokens = new Tokens([
            { symbol: "A", text: "text1" },
            { symbol: "B", text: " text2" },
            { symbol: "C", text: "text3 " },
            { symbol: "D", text: " text4 " },
            { symbol: "E", text: "  text5  " },
            { symbol: "", text: " text6 " }
        ]);
        expect(tokens.setTokenText("A", "text1'", true, true)).toEqual({ symbol: "A", text: "text1'" });
        expect(tokens.setTokenText("B", "text2'", true, true)).toEqual({ symbol: "B", text: " text2'" });
        expect(tokens.setTokenText("B", "text2'", false, true)).toEqual({ symbol: "B", text: "text2'" });
        expect(tokens.setTokenText("C", "text3'", true, true)).toEqual({ symbol: "C", text: "text3' " });
        expect(tokens.setTokenText("C", "text3'", false, true)).toEqual({ symbol: "C", text: "text3'" });
        expect(tokens.setTokenText("D", "text4'", true, true)).toEqual({ symbol: "D", text: " text4' " });
        expect(tokens.setTokenText("D", "text4'", false, true)).toEqual({ symbol: "D", text: "text4'" });
        expect(tokens.setTokenText("E", "text5'", true, true)).toEqual({ symbol: "E", text: "  text5'  " });
        expect(tokens.setTokenText("E", "text5'", false, true)).toEqual({ symbol: "E", text: "text5'" });
        expect(tokens.setTokenText("", "text6'", true, true)).toEqual({ symbol: "", text: " text6' " });
        expect(tokens.setTokenText("", "text6'", false, true)).toEqual({ symbol: "", text: "text6'" });
    });
    test('setTokenText() create=true', (): void => {
        const tokens = new Tokens([
            { symbol: "A", text: "text1 " }
        ]);
        tokens.setTokenText("B", "text2", true, true);
        expect(tokens.join()).toBe("Atext1 Btext2");
    });
    test('getTokenText()', (): void => {
        const tokens = new Tokens([
            { symbol: "A", text: "  hello world  " },
        ]);

        expect(tokens.getTokenText("A", false)).toBe("  hello world  ");
        expect(tokens.getTokenText("B", false)).toBe(null);

        expect(tokens.getTokenText("A", true)).toBe("hello world");
        expect(tokens.getTokenText("B", true)).toBe(null);
    });
    test('setTokenText() create=true appending space', (): void => {
        const tokens = new Tokens([
            { symbol: "A", text: "text1" }
        ]);
        tokens.setTokenText("B", "text2", true, true);
        expect(tokens.join()).toBe("Atext1 Btext2");
    });
    test('join', (): void => {
        expect(new Tokens([
            { symbol: "A", text: "text1" },
            { symbol: "B", text: " text2" },
            { symbol: "C", text: "text3 " },
            { symbol: "D", text: " text4 " },
            { symbol: "", text: " text5 " }
        ]).join())
            .toEqual("Atext1B text2Ctext3 D text4  text5 ");
    });
});

describe('TasksPluginReminderLine', (): void => {
    test('parse()', (): void => {
        const parsed = TasksPluginReminderLine.parse("this is a title 🔁 every hour 📅 2021-09-08 ✅ 2021-08-31");
        expect(parsed.getDescription()).toBe("this is a title");
        expect(parsed.getDueDate().toString()).toBe("2021-09-08");
        expect(parsed.getDoneDate().toString()).toBe("2021-08-31");
    });
    test('setDescription()', (): void => {
        const parsed = TasksPluginReminderLine.parse("this is a title 🔁 every hour 📅 2021-09-08 ✅ 2021-08-31");
        parsed.setDescription("ABC");
        expect(parsed.getDescription()).toBe("ABC");
        expect(parsed.toLine()).toBe("ABC 🔁 every hour 📅 2021-09-08 ✅ 2021-08-31");
    });
    test('setDueDate() - date', (): void => {
        const parsed = TasksPluginReminderLine.parse("this is a title 🔁 every hour 📅 2021-09-08 ✅ 2021-08-31");
        parsed.setDueDate(new DateTime(moment("2021-09-09"), false));
        expect(parsed.getDueDate().toString()).toBe("2021-09-09");
        expect(parsed.toLine()).toBe("this is a title 🔁 every hour 📅 2021-09-09 ✅ 2021-08-31");
    });
    test('setDueDate() - string', (): void => {
        const parsed = TasksPluginReminderLine.parse("this is a title 🔁 every hour 📅 2021-09-08 ✅ 2021-08-31");
        parsed.setDueDate("XXX");
        expect(parsed.getDueDate()).toBe(null);
        expect(parsed.toLine()).toBe("this is a title 🔁 every hour 📅 XXX ✅ 2021-08-31");
    });
    test('setDueDate() - append - with space', (): void => {
        const parsed = TasksPluginReminderLine.parse("this is a title 🔁 every hour ✅ 2021-08-31");
        parsed.setDueDate(new DateTime(moment("2021-09-08"), false));
        expect(parsed.getDueDate().toString()).toBe("2021-09-08");
        expect(parsed.toLine()).toBe("this is a title 🔁 every hour ✅ 2021-08-31 📅 2021-09-08");
    });
    test('setDueDate() - append - without space', (): void => {
        const parsed = TasksPluginReminderLine.parse("this is a title 🔁every hour ✅2021-08-31");
        parsed.setDueDate(new DateTime(moment("2021-09-08"), false));
        expect(parsed.getDueDate().toString()).toBe("2021-09-08");
        expect(parsed.toLine()).toBe("this is a title 🔁every hour ✅2021-08-31 📅2021-09-08");
    });
    test('setDueDate() - append - no advice', (): void => {
        const parsed = TasksPluginReminderLine.parse("this is a title");
        parsed.setDueDate(new DateTime(moment("2021-09-08"), false));
        expect(parsed.getDueDate().toString()).toBe("2021-09-08");
        expect(parsed.toLine()).toBe("this is a title 📅 2021-09-08");
    });
});

/*
describe('TasksPluginFormat', (): void => {

    test('parseReminderLine()', (): void => {
        // normal
        {
            const line = TasksPluginFormat.parseReminderLine("- [ ] this is a title 🔁every hour📅2021-09-08 ✅2021-08-31");
            expect(line.doneDate).toBe("2021-08-31");
            expect(line.dueDate).toBe("2021-09-08");
            expect(line.recurrence).toBe("every hour");
            expect(line.prefix).toBe("");
            expect(line.title).toBe("this is a title");
            expect(line.toLine()).toBe("- [ ] this is a title 🔁every hour 📅2021-09-08 ✅2021-08-31");
        }
        // with space
        {
            const line = TasksPluginFormat.parseReminderLine("- [ ] this is a title 🔁 every hour 📅 2021-09-08 ✅ 2021-08-31");
            expect(line.doneDate).toBe("2021-08-31");
            expect(line.dueDate).toBe("2021-09-08");
            expect(line.recurrence).toBe("every hour");
            expect(line.prefix).toBe("");
            expect(line.title).toBe("this is a title");
            expect(line.toLine()).toBe("- [ ] this is a title 🔁every hour 📅2021-09-08 ✅2021-08-31");
        }
    });

    test('modify()', (): void => {
        // normal
        {
            const edit = new ReminderEdit();
            edit.checked = true;
            const line = TasksPluginFormat.instance.modify("- [ ] this is a title 🔁every hour 📅2021-09-08", edit);
            expect(line).toBe("- [x] this is a title 🔁every hour 📅2021-09-08 ✅2021-09-01");
        }
        // with space
        {
            const edit = new ReminderEdit();
            edit.checked = true;
            const line = TasksPluginFormat.instance.modify("- [ ] this is a title 🔁 every hour 📅 2021-09-08", edit);
            expect(line).toBe("- [x] this is a title 🔁 every hour 📅 2021-09-08 ✅ 2021-09-01");
        }
    })
})
*/