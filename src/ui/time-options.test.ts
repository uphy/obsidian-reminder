import { timeOptions } from "./time-options";

describe("timeOptions()", (): void => {
  test("a value on the grid adds nothing", (): void => {
    const options = timeOptions(15, "09:15");
    expect(options.length).toBe(96);
    expect(options[0]).toBe("00:00");
    expect(options[95]).toBe("23:45");
  });

  test("a value off the grid is added in order", (): void => {
    const options = timeOptions(15, "09:25");
    expect(options.length).toBe(97);
    const index = options.indexOf("09:25");
    expect(options[index - 1]).toBe("09:15");
    expect(options[index + 1]).toBe("09:30");
  });

  test("an empty or malformed value adds nothing", (): void => {
    expect(timeOptions(15, "").length).toBe(96);
    expect(timeOptions(15, "9:25").length).toBe(96);
    expect(timeOptions(15, "25:00").length).toBe(96);
    expect(timeOptions(15, "09:61").length).toBe(96);
  });
});
