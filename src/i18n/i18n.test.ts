import {
  type LanguageCode,
  getLanguage,
  getLanguageSetting,
  hasTranslation,
  languageFromTag,
  languageLabel,
  monthShortName,
  onLanguageChange,
  resolveLanguage,
  setLanguage,
  t,
  tn,
  translationsOf,
  weekdayName,
  weekdayShortName,
} from "i18n";

const placeholders = (text: string): Array<string> =>
  [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]!).sort();

describe("t()", () => {
  afterEach(() => {
    setLanguage("en");
  });

  test("returns the English text itself in English", () => {
    setLanguage("en");

    expect(t("Reminder time")).toBe("Reminder time");
  });

  test("translates into the selected language", () => {
    setLanguage("zh-cn");

    expect(t("Reminder time")).toBe("提醒时间");
    expect(getLanguage()).toBe("zh-cn");
  });

  test("falls back to the English text for a string without a translation", () => {
    setLanguage("zh-cn");

    expect(t("Some untranslated string")).toBe("Some untranslated string");
  });

  test("substitutes placeholders after translating", () => {
    setLanguage("zh-cn");

    expect(t("Disabled until {time}", { time: "09:00" })).toBe(
      "Disabled until 09:00",
    );
    expect(
      t("Reminder notifications paused until {time}", { time: "09:00" }),
    ).toBe("提醒通知已暂停，直到 09:00");
  });

  test("leaves a placeholder without a value in place", () => {
    expect(t("Hello {name}")).toBe("Hello {name}");
  });
});

describe("tn()", () => {
  afterEach(() => {
    setLanguage("en");
  });

  test("picks the singular template for one and the plural otherwise", () => {
    setLanguage("en");

    expect(tn(1, "Muted {count} reminder", "Muted {count} reminders")).toBe(
      "Muted 1 reminder",
    );
    expect(tn(2, "Muted {count} reminder", "Muted {count} reminders")).toBe(
      "Muted 2 reminders",
    );
  });

  test("uses the same translated template for both counts", () => {
    setLanguage("zh-cn");

    expect(tn(1, "Muted {count} reminder", "Muted {count} reminders")).toBe(
      "已忽略 1 条提醒",
    );
    expect(tn(3, "Muted {count} reminder", "Muted {count} reminders")).toBe(
      "已忽略 3 条提醒",
    );
  });
});

describe("setLanguage()", () => {
  afterEach(() => {
    setLanguage("en");
  });

  test("records the raw setting value, including auto", () => {
    setLanguage("auto");

    expect(getLanguageSetting()).toBe("auto");
  });

  test("notifies listeners once per actual language change", () => {
    setLanguage("en");
    const languages: Array<LanguageCode> = [];
    const unsubscribe = onLanguageChange((language) =>
      languages.push(language),
    );

    setLanguage("zh-cn");
    setLanguage("zh-cn");
    unsubscribe();
    setLanguage("en");

    expect(languages).toEqual(["zh-cn"]);
  });

  test("applies an invalid persisted value as auto", () => {
    setLanguage("klingon" as LanguageCode);

    expect(getLanguageSetting()).toBe("auto");
  });
});

describe("language resolution", () => {
  test("maps Simplified and Traditional Chinese tags to zh-cn", () => {
    expect(languageFromTag("zh")).toBe("zh-cn");
    expect(languageFromTag("zh-TW")).toBe("zh-cn");
    expect(languageFromTag("zh_CN")).toBe("zh-cn");
  });

  test("maps every other tag to English", () => {
    expect(languageFromTag("en")).toBe("en");
    expect(languageFromTag("en-GB")).toBe("en");
    expect(languageFromTag("ja")).toBe("en");
    expect(languageFromTag("")).toBe("en");
  });

  test("returns the setting itself for an explicit language", () => {
    expect(resolveLanguage("zh-cn")).toBe("zh-cn");
    expect(resolveLanguage("en")).toBe("en");
  });
});

describe("automatic language detection", () => {
  afterEach(() => {
    setLanguage("en");
    window.localStorage.clear();
    document.documentElement.removeAttribute("lang");
  });

  test("follows the language Obsidian itself stored", () => {
    window.localStorage.setItem("language", "zh");

    expect(resolveLanguage("auto")).toBe("zh-cn");
  });

  test("falls back to the document language, mapping zh-TW to zh-cn", () => {
    document.documentElement.lang = "zh-TW";

    expect(resolveLanguage("auto")).toBe("zh-cn");
  });

  test("prefers Obsidian's stored language over the document language", () => {
    window.localStorage.setItem("language", "en");
    document.documentElement.lang = "zh";

    expect(resolveLanguage("auto")).toBe("en");
  });

  test("applies the detected language when the setting is auto", () => {
    window.localStorage.setItem("language", "zh");

    setLanguage("auto");

    expect(getLanguage()).toBe("zh-cn");
    expect(getLanguageSetting()).toBe("auto");
  });
});

describe("languageLabel()", () => {
  afterEach(() => {
    setLanguage("en");
  });

  test("shows each language in its own language, and translates auto", () => {
    expect(languageLabel("en")).toBe("English");
    expect(languageLabel("zh-cn")).toBe("简体中文");
    expect(languageLabel("auto")).toBe("Automatic (follow Obsidian)");

    setLanguage("zh-cn");

    expect(languageLabel("auto")).toBe("自动（跟随 Obsidian）");
    expect(languageLabel("zh-cn")).toBe("简体中文");
  });
});

describe("weekday and month names", () => {
  afterEach(() => {
    setLanguage("en");
  });

  test("are English by default", () => {
    expect(weekdayName(1)).toBe("Monday");
    expect(weekdayShortName(0)).toBe("Sun");
    expect(monthShortName(0)).toBe("Jan");
  });

  test("follow the selected language", () => {
    setLanguage("zh-cn");

    expect(weekdayName(1)).toBe("星期一");
    expect(weekdayShortName(0)).toBe("日");
    expect(monthShortName(0)).toBe("1月");
  });

  test("wrap around the week and the year", () => {
    expect(weekdayName(7)).toBe("Sunday");
    expect(weekdayShortName(-1)).toBe("Sat");
    expect(monthShortName(12)).toBe("Jan");
  });
});

describe("zh-cn dictionary", () => {
  const dictionary = translationsOf("zh-cn");

  test("has no empty translations", () => {
    const empty = Object.entries(dictionary)
      .filter(([, value]) => value.trim().length === 0)
      .map(([key]) => key);

    expect(empty).toEqual([]);
  });

  test("keeps every placeholder of the English key", () => {
    const mismatched = Object.entries(dictionary)
      .filter(
        ([key, value]) =>
          placeholders(key).join(",") !== placeholders(value).join(","),
      )
      .map(([key]) => key);

    expect(mismatched).toEqual([]);
  });

  test("is only consulted for non-English languages", () => {
    setLanguage("zh-cn");
    expect(hasTranslation("Reminder time")).toBe(true);

    setLanguage("en");
    expect(hasTranslation("Reminder time")).toBe(false);
  });
});
