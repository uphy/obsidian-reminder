import { getLanguage, setLanguage } from "i18n";
import { moment } from "model/moment";
import {
  DateTime,
  Time,
  defaultLaters,
  parseLater,
  parseLaters,
} from "model/time";

/**
 * Obsidian's bundled moment ships every locale, which is why the display
 * formats can render month and weekday names in the selected language at all.
 * The npm moment jest uses ships locales as separate modules, so the one these
 * tests need is defined here instead of being imported (importing it would add
 * it to the global moment for the whole test file, hiding the "the plugin never
 * calls moment.locale()" assertion below).
 */
beforeAll(() => {
  if (!moment.locales().includes("zh-cn")) {
    moment.defineLocale("zh-cn", {
      months:
        "一月_二月_三月_四月_五月_六月_七月_八月_九月_十月_十一月_十二月".split(
          "_",
        ),
      monthsShort: "1月_2月_3月_4月_5月_6月_7月_8月_9月_10月_11月_12月".split(
        "_",
      ),
      weekdays: "星期日_星期一_星期二_星期三_星期四_星期五_星期六".split("_"),
      weekdaysShort: "周日_周一_周二_周三_周四_周五_周六".split("_"),
      weekdaysMin: "日_一_二_三_四_五_六".split("_"),
    });
  }
});

afterEach(() => {
  setLanguage("en");
  window.localStorage.clear();
  moment.locale("en");
});

describe("parseLater()", () => {
  test("labels a relative option in English", () => {
    expect(parseLater("in 2 hours").label).toBe("In 2 hours");
  });

  test("keeps the singular unit singular", () => {
    expect(parseLater("in 1 minute").label).toBe("In 1 minute");
    // The count decides the unit word, so "1 hours" is labelled in the
    // singular too.
    expect(parseLater("in 1 hours").label).toBe("In 1 hour");
  });

  test("translates the label but still parses the English input", () => {
    setLanguage("zh-cn");

    expect(parseLater("in 2 hours").label).toBe("2 小时后");
    expect(parseLater("in 1 minute").label).toBe("1 分钟后");
    expect(parseLater("tomorrow").label).toBe("明天");
  });

  test("parses a whole list of English options under another language", () => {
    setLanguage("zh-cn");

    expect(
      parseLaters("In 30 minutes\nTomorrow").map((later) => later.label),
    ).toEqual(["30 分钟后", "明天"]);
  });

  test("rejects an unsupported option in the selected language", () => {
    setLanguage("zh-cn");

    expect(() => parseLater("in 2 fortnights")).toThrow("不支持的格式");
  });
});

describe("defaultLaters()", () => {
  test("is rebuilt in the active language", () => {
    expect(defaultLaters().map((later) => later.label)).toEqual([
      "In 30 minutes",
      "In 1 hours",
      "In 3 hours",
      "Tomorrow",
      "Next week",
    ]);

    setLanguage("zh-cn");

    expect(defaultLaters().map((later) => later.label)).toEqual([
      "30 分钟后",
      "1 小时后",
      "3 小时后",
      "明天",
      "下周",
    ]);
  });
});

describe("DateTime.formatForDisplay()", () => {
  test("applies the selected language per instance, not to moment", () => {
    setLanguage("zh-cn");

    const time = DateTime.parse("2026-11-05");

    expect(time.formatForDisplay("MMMM YYYY")).toBe("十一月 2026");
    expect(time.formatForDisplay("ddd")).toBe("周四");
    // The app's locale is shared with Obsidian's own date parsing, so the
    // plugin must never change it.
    expect(moment.locale()).toBe("en");
  });

  test("leaves format() on the app's locale, whatever the setting is", () => {
    setLanguage("zh-cn");

    // format() is the write path (DATE_TIME_FORMATTER.toString()); changing it
    // with the display language would make written dates unreadable to the
    // parser, which uses the app's locale.
    expect(DateTime.parse("2026-11-05").format("MMMM YYYY")).toBe(
      "November 2026",
    );
    expect(DateTime.parse("2026-11-05").formatForDisplay("MMMM")).toBe(
      "十一月",
    );
  });

  test("renders in the app's locale when the setting is automatic", () => {
    // "Automatic" is deliberately a no-op for dates: Obsidian already sets
    // moment's locale from its own UI language, and taking the resolved
    // language instead would change how dates render for everyone who never
    // touched the setting.
    window.localStorage.setItem("language", "zh");
    setLanguage("auto");

    expect(getLanguage()).toBe("zh-cn");
    expect(DateTime.parse("2026-11-05").formatForDisplay("MMMM")).toBe(
      "November",
    );
  });

  test("applies the default time before formatting", () => {
    const time = DateTime.parse("2026-11-05");

    expect(time.formatForDisplay("HH:mm[ on ]MMMM", Time.parse("09:30"))).toBe(
      "09:30 on November",
    );
  });
});
