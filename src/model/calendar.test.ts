import moment from "moment";
import { Calendar } from "./calendar"

describe('Calendar', (): void => {
    const calendar = new Calendar(moment("2021-09-23"));
    test('constructor()', (): void => {
        expect(calendar.current.monthStart.format("YYYY-MM-DD")).toBe("2021-09-01");
        expect(calendar.current.weeks.length).toBe(5);
        expect(calendar.current.weeks[0].days[0].date.format("YYYY-MM-DD")).toBe("2021-08-29");
        expect(calendar.current.weeks[4].days[6].date.format("YYYY-MM-DD")).toBe("2021-10-02");
        expect(calendar.current.isThisMonth(calendar.current.weeks[0].days[2].date)).toBe(false); // 8/31
        expect(calendar.current.isThisMonth(calendar.current.weeks[0].days[3].date)).toBe(true); // 9/1
        expect(calendar.current.isThisMonth(calendar.current.weeks[4].days[4].date)).toBe(true); // 9/30
        expect(calendar.current.isThisMonth(calendar.current.weeks[4].days[5].date)).toBe(false); // 10/1
    });
    test('nextMonth()', (): void => {
        calendar.nextMonth();
        expect(calendar.current.monthStart.format("YYYY-MM-DD")).toBe("2021-10-01");
        expect(calendar.current.weeks.length).toBe(6);
        expect(calendar.current.weeks[0].days[0].date.format("YYYY-MM-DD")).toBe("2021-09-26");
        expect(calendar.current.weeks[5].days[6].date.format("YYYY-MM-DD")).toBe("2021-11-06");
        expect(calendar.current.isThisMonth(calendar.current.weeks[0].days[4].date)).toBe(false); // 9/30
        expect(calendar.current.isThisMonth(calendar.current.weeks[0].days[5].date)).toBe(true); // 10/1
        expect(calendar.current.isThisMonth(calendar.current.weeks[5].days[0].date)).toBe(true); // 10/31
        expect(calendar.current.isThisMonth(calendar.current.weeks[5].days[1].date)).toBe(false); // 11/1
    });
    test('previousMonth()', (): void => {
        calendar.previousMonth();
        expect(calendar.current.monthStart.format("YYYY-MM-DD")).toBe("2021-09-01");
        expect(calendar.current.weeks.length).toBe(5);
        expect(calendar.current.weeks[0].days[0].date.format("YYYY-MM-DD")).toBe("2021-08-29");
        expect(calendar.current.weeks[4].days[6].date.format("YYYY-MM-DD")).toBe("2021-10-02");
        expect(calendar.current.isThisMonth(calendar.current.weeks[0].days[2].date)).toBe(false); // 8/31
        expect(calendar.current.isThisMonth(calendar.current.weeks[0].days[3].date)).toBe(true); // 9/1
        expect(calendar.current.isThisMonth(calendar.current.weeks[4].days[4].date)).toBe(true); // 9/30
        expect(calendar.current.isThisMonth(calendar.current.weeks[4].days[5].date)).toBe(false); // 10/1
    });
})