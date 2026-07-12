import { Calendar } from "ui/calendar";
import moment from "moment";

describe("Calendar", (): void => {
  let calendar = new Calendar(moment("2021-09-23"));
  test("constructor()", (): void => {
    expect(calendar.current.monthStart.format("YYYY-MM-DD")).toBe("2021-09-01");
    expect(calendar.current.weeks.length).toBe(5);
    expect(calendar.current.weeks[0]!.days[0]!.date.format("YYYY-MM-DD")).toBe(
      "2021-08-29",
    );
    expect(calendar.current.weeks[4]!.days[6]!.date.format("YYYY-MM-DD")).toBe(
      "2021-10-02",
    );
    expect(
      calendar.current.isThisMonth(calendar.current.weeks[0]!.days[2]!.date),
    ).toBe(false); // 8/31
    expect(
      calendar.current.isThisMonth(calendar.current.weeks[0]!.days[3]!.date),
    ).toBe(true); // 9/1
    expect(
      calendar.current.isThisMonth(calendar.current.weeks[4]!.days[4]!.date),
    ).toBe(true); // 9/30
    expect(
      calendar.current.isThisMonth(calendar.current.weeks[4]!.days[5]!.date),
    ).toBe(false); // 10/1
  });
  test("nextMonth()", (): void => {
    calendar = calendar.nextMonth();
    expect(calendar.current.monthStart.format("YYYY-MM-DD")).toBe("2021-10-01");
    expect(calendar.current.weeks.length).toBe(6);
    expect(calendar.current.weeks[0]!.days[0]!.date.format("YYYY-MM-DD")).toBe(
      "2021-09-26",
    );
    expect(calendar.current.weeks[5]!.days[6]!.date.format("YYYY-MM-DD")).toBe(
      "2021-11-06",
    );
    expect(
      calendar.current.isThisMonth(calendar.current.weeks[0]!.days[4]!.date),
    ).toBe(false); // 9/30
    expect(
      calendar.current.isThisMonth(calendar.current.weeks[0]!.days[5]!.date),
    ).toBe(true); // 10/1
    expect(
      calendar.current.isThisMonth(calendar.current.weeks[5]!.days[0]!.date),
    ).toBe(true); // 10/31
    expect(
      calendar.current.isThisMonth(calendar.current.weeks[5]!.days[1]!.date),
    ).toBe(false); // 11/1
  });
  test("previousMonth()", (): void => {
    calendar = calendar.previousMonth();
    expect(calendar.current.monthStart.format("YYYY-MM-DD")).toBe("2021-09-01");
    expect(calendar.current.weeks.length).toBe(5);
    expect(calendar.current.weeks[0]!.days[0]!.date.format("YYYY-MM-DD")).toBe(
      "2021-08-29",
    );
    expect(calendar.current.weeks[4]!.days[6]!.date.format("YYYY-MM-DD")).toBe(
      "2021-10-02",
    );
    expect(
      calendar.current.isThisMonth(calendar.current.weeks[0]!.days[2]!.date),
    ).toBe(false); // 8/31
    expect(
      calendar.current.isThisMonth(calendar.current.weeks[0]!.days[3]!.date),
    ).toBe(true); // 9/1
    expect(
      calendar.current.isThisMonth(calendar.current.weeks[4]!.days[4]!.date),
    ).toBe(true); // 9/30
    expect(
      calendar.current.isThisMonth(calendar.current.weeks[4]!.days[5]!.date),
    ).toBe(false); // 10/1
  });
});

describe("Calendar with weekStart=Monday", (): void => {
  const calendar = new Calendar(moment("2021-09-23"), undefined, 1);
  test("constructor() starts weeks on Monday", (): void => {
    expect(calendar.current.weeks[0]!.days[0]!.date.format("YYYY-MM-DD")).toBe(
      "2021-08-30",
    );
    expect(calendar.current.weeks[0]!.days[0]!.date.day()).toBe(1);
    expect(calendar.current.weeks[0]!.days[6]!.date.format("YYYY-MM-DD")).toBe(
      "2021-09-05",
    );
  });
  test("isHoliday() is absolute Sat/Sun regardless of week start", (): void => {
    const saturday = calendar.current.weeks[0]!.days.find(
      (day) => day.date.format("YYYY-MM-DD") === "2021-09-04",
    )!;
    const monday = calendar.current.weeks[1]!.days.find(
      (day) => day.date.format("YYYY-MM-DD") === "2021-09-06",
    )!;
    expect(saturday.isHoliday()).toBe(true);
    expect(monday.isHoliday()).toBe(false);
  });
});
