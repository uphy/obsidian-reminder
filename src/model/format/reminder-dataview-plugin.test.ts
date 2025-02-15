/**
 * @jest-environment
 */
import { DateTime } from "model/time";
import moment from "moment";
import { DataviewDateTimeFormat, DataviewReminderModel } from "./reminder-dataview-plugin";

describe('DataviewDateTimeFormat', (): void => {
    test("format - no page link", (): void => {
        const sut = new DataviewDateTimeFormat({
            dateTrigger: "due:: ",
            dateFormat: "YYYY-MM-DD",
        });
        expect(sut.format(new DateTime(moment("2024-09-12"), false))).toBe("[due:: 2024-09-12]");
    });
    test("split - no page link", (): void => {
        const sut = new DataviewDateTimeFormat({
            dateTrigger: "due:: ",
            dateFormat: "YYYY-MM-DD",
        });

        {
            const res = sut.split("a b c [due:: 2024-09-12]");
            expect(res.title).toBe("a b c");
            expect(res.time!.toString()).toBe("2024-09-12");
        }
        {
            const res = sut.split("a b c [due:: 2021-09-12]");
            expect(res.title).toBe("a b c");
            expect(res.time!.toString()).toBe("2021-09-12");
        }
        {
            const res = sut.split("a b c [due:: invalid]");
            expect(res.title).toBe("a b c [due:: invalid]");
            expect(res.time).toBe(undefined);
        }
        {
            const res = sut.split("a b c @@{invalid}");
            expect(res.title).toBe("a b c @@{invalid}");
            expect(res.time).toBe(undefined);
        }
    });
});

describe('DataviewReminderFormat', (): void => {
    test('parse()', (): void => {
        const parsed = DataviewReminderModel.parse("task1 [due:: 2021-09-08]");
        expect(parsed!.time.toString()).toBe("2021-09-08");
        expect(parsed!.title).toBe("task1");
    });
    test('setDate() simple', (): void => {
        const parsed = DataviewReminderModel.parse("task1 [due:: 2021-09-07]");
        parsed!.setTime(new DateTime(moment("2021-09-08"), false));
        expect(parsed!.toMarkdown()).toBe("task1 [due:: 2021-09-08]");
    });
});