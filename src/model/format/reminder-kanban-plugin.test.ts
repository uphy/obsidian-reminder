import { DateTime } from "model/time";
import moment from "moment";
import { KanbanReminderFormat } from "./reminder-kanban-plugin";

describe('KanbanReminderFormat', (): void => {
    test('parse()', (): void => {
        const parsed = KanbanReminderFormat.parse("task1 @{2021-09-08}");
        expect(parsed.date).toBe("2021-09-08");
        expect(parsed.time).toBe(undefined);
        expect(parsed.getDateTime().toString()).toBe("2021-09-08");
        expect(parsed.title1).toBe("task1 ");
        expect(parsed.title2).toBe("");
    });
    test('parse() with time', (): void => {
        const parsed = KanbanReminderFormat.parse("task1 @{2021-09-08} @@{12:15}");
        expect(parsed.date).toBe("2021-09-08");
        expect(parsed.time).toBe("12:15");
        expect(parsed.getDateTime().toString()).toBe("2021-09-08 12:15");
        expect(parsed.title1).toBe("task1 ");
        expect(parsed.title2).toBe("");
    });
    test('setDate() simple', (): void => {
        expect(KanbanReminderFormat.instance.modify("task1 @{2021-09-07}", {
            time: new DateTime(moment("2021-09-08"), false)
        })).toBe("task1 @{2021-09-08}");
    });
    test('setDate() with time', (): void => {
        expect(KanbanReminderFormat.instance.modify("task1 @{2021-09-07}", {
            time: new DateTime(moment("2021-09-08 10:00"), true)
        })).toBe("task1 @{2021-09-08} @@{10:00}");
    });
});
