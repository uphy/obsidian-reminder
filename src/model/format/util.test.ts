import { escapeRegExpChars } from "./util";

describe('toRegExp()', (): void => {
    test("test", (): void => {
        expect(escapeRegExpChars("abcd")).toBe("abcd");
        expect(escapeRegExpChars("\\ ^ $ . * + ? ( ) [ ] { } | abc")).toBe(`\\\\ \\^ \\$ \\. \\* \\+ \\? \\( \\) \\[ \\] \\{ \\} \\| abc`);
    });
});