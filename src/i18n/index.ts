import { ja } from "./ja";
import { zhCN } from "./zh-cn";

/**
 * Plugin-local UI translations.
 *
 * The English text *is* the translation key: `t("Reminder time")` looks up
 * "Reminder time" in the dictionary of the active language and falls back to
 * the English text itself when the key is missing. Keeping the key identical
 * to the English string means the source stays readable, English needs no
 * dictionary at all, and a missing translation degrades to English instead of
 * showing a raw key.
 *
 * This module imports nothing from `obsidian`, so the model layer can use it
 * and jest can load it. It only maps English text to translations: switching
 * language deliberately has no global side effect. Month and weekday names in
 * the user-configured display formats are applied per instance by
 * `DateTime.formatForDisplay()` (see `model/time.ts`), because moment's locale
 * is app-wide and shared with Obsidian's own date parsing and with the dates
 * this plugin writes to the vault.
 */

export type LanguageCode = "en" | "ja" | "zh-cn";

/**
 * The value persisted in the "Language" setting. `"auto"` follows Obsidian's
 * own UI language instead of pinning one.
 */
export type LanguageSetting = "auto" | LanguageCode;

/** Every language the plugin ships, in the order the setting offers them. */
export const LANGUAGE_CODES: ReadonlyArray<LanguageCode> = [
  "en",
  "ja",
  "zh-cn",
];

/** Every value the "Language" setting can hold, in dropdown order. */
export const LANGUAGE_SETTINGS: ReadonlyArray<LanguageSetting> = [
  "auto",
  ...LANGUAGE_CODES,
];

/** Each language's name in that language, so the dropdown is readable either way. */
const LANGUAGE_NATIVE_NAMES: Record<LanguageCode, string> = {
  en: "English",
  ja: "日本語",
  "zh-cn": "简体中文",
};

export type TranslationParams = Record<string, string | number>;

const dictionaries: Record<LanguageCode, Record<string, string>> = {
  en: {},
  ja,
  "zh-cn": zhCN,
};

let languageSetting: LanguageSetting = "auto";
let activeLanguage: LanguageCode = "en";

const listeners = new Set<(language: LanguageCode) => void>();

/** The language currently used for translations. */
export function getLanguage(): LanguageCode {
  return activeLanguage;
}

/** The raw "Language" setting value, including `"auto"`. */
export function getLanguageSetting(): LanguageSetting {
  return languageSetting;
}

/**
 * Applies the "Language" setting value. Safe to call repeatedly: it only
 * notifies listeners when the resolved language actually changes.
 */
export function setLanguage(setting: LanguageSetting): void {
  languageSetting = isLanguageSetting(setting) ? setting : "auto";
  const resolved = resolveLanguage(languageSetting);
  if (resolved === activeLanguage) {
    return;
  }
  activeLanguage = resolved;
  listeners.forEach((listener) => listener(resolved));
}

/**
 * Registers a callback invoked whenever the resolved language changes, and
 * returns a function that unregisters it.
 */
export function onLanguageChange(
  listener: (language: LanguageCode) => void,
): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Resolves a setting value to a language the plugin can actually display. */
export function resolveLanguage(setting: LanguageSetting): LanguageCode {
  if (setting !== "auto") {
    return setting;
  }
  return languageFromTag(detectedObsidianLanguage());
}

/**
 * Maps an Obsidian UI language tag ("zh", "zh-TW", "en-GB", ...) to the
 * language the plugin displays. Anything the plugin does not translate falls
 * back to English, which is also what an unset language (Obsidian's default)
 * resolves to.
 */
export function languageFromTag(tag: string): LanguageCode {
  const normalized = tag.trim().toLowerCase().replace(/_/g, "-");
  if (normalized === "ja" || normalized.startsWith("ja-")) {
    return "ja";
  }
  if (normalized.startsWith("zh")) {
    return "zh-cn";
  }
  return "en";
}

/** The name of a language, or of the "follow Obsidian" option. */
export function languageLabel(setting: LanguageSetting): string {
  if (setting === "auto") {
    return t("Automatic (follow Obsidian)");
  }
  return LANGUAGE_NATIVE_NAMES[setting];
}

/**
 * Translates an English UI string into the active language, substituting
 * `{name}` placeholders from `params`.
 */
export function t(template: string, params?: TranslationParams): string {
  const translated = dictionaries[activeLanguage][template];
  return interpolate(translated ?? template, params);
}

/**
 * Translates the singular or plural template for `count`.
 *
 * English needs the distinction ("1 reminder" / "2 reminders") while Chinese
 * and Japanese do not, so both templates are keys of their own and `{count}` is
 * available to either.
 */
export function tn(
  count: number,
  singular: string,
  plural: string,
  params?: TranslationParams,
): string {
  return t(count === 1 ? singular : plural, { count, ...params });
}

/**
 * Whether the active language has its own text for `template`. English is the
 * source language, so it never does.
 */
export function hasTranslation(template: string): boolean {
  return dictionaries[activeLanguage][template] !== undefined;
}

/** All templates translated into `language`, for tests and tooling. */
export function translationsOf(language: LanguageCode): Record<string, string> {
  return dictionaries[language];
}

function interpolate(text: string, params?: TranslationParams): string {
  if (params === undefined) {
    return text;
  }
  return text.replace(/\{(\w+)\}/g, (placeholder, name: string) => {
    const value = params[name];
    return value === undefined ? placeholder : String(value);
  });
}

function isLanguageSetting(value: string): value is LanguageSetting {
  return (
    value === "auto" ||
    (LANGUAGE_CODES as ReadonlyArray<string>).includes(value)
  );
}

/**
 * Reads the language Obsidian's UI is displayed in.
 *
 * Obsidian stores it in `localStorage` (`"language"`) and leaves it unset for
 * English; its own `getLanguage()` accessor is not used because it only exists
 * since Obsidian 1.8.7 while this plugin supports older versions (see
 * `manifest.json`'s `minAppVersion`). The document/`navigator` branches only
 * matter outside the app -- e.g. a coarse but harmless fallback while running
 * under a test runner.
 */
function detectedObsidianLanguage(): string {
  try {
    const stored = window.localStorage.getItem("language");
    if (stored != null && stored.length > 0) {
      return stored;
    }
    // Obsidian leaves `localStorage` unset for English, but its UI language may
    // still be set on the document by the desktop shell.
    const documentLanguage = document.documentElement.getAttribute("lang");
    if (documentLanguage != null && documentLanguage.length > 0) {
      return documentLanguage;
    }
  } catch {
    // `window`/`document` are unavailable (a non-DOM runtime): fall through to
    // the navigator language below.
  }
  try {
    return navigator.language ?? "en";
  } catch {
    return "en";
  }
}

// ---------------------------------------------------------------------------
// Weekday and month names
//
// The calendar and the "Week start" setting need these in the selected
// language regardless of whether moment ships locale data for it, so they are
// part of the dictionary rather than left to `moment.locale()`.
// ---------------------------------------------------------------------------

/** Indexed by moment's `day()`: 0 is Sunday. */
const WEEKDAY_NAMES: Record<LanguageCode, ReadonlyArray<string>> = {
  en: [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ],
  ja: ["日曜日", "月曜日", "火曜日", "水曜日", "木曜日", "金曜日", "土曜日"],
  "zh-cn": [
    "星期日",
    "星期一",
    "星期二",
    "星期三",
    "星期四",
    "星期五",
    "星期六",
  ],
};

/** Short weekday names for the calendar header, indexed by `day()` (0 = Sunday). */
const WEEKDAY_SHORT_NAMES: Record<LanguageCode, ReadonlyArray<string>> = {
  en: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
  ja: ["日", "月", "火", "水", "木", "金", "土"],
  "zh-cn": ["日", "一", "二", "三", "四", "五", "六"],
};

/** Short month names for the calendar header, indexed by month (0 = January). */
const MONTH_SHORT_NAMES: Record<LanguageCode, ReadonlyArray<string>> = {
  en: [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ],
  ja: [
    "1月",
    "2月",
    "3月",
    "4月",
    "5月",
    "6月",
    "7月",
    "8月",
    "9月",
    "10月",
    "11月",
    "12月",
  ],
  "zh-cn": [
    "1月",
    "2月",
    "3月",
    "4月",
    "5月",
    "6月",
    "7月",
    "8月",
    "9月",
    "10月",
    "11月",
    "12月",
  ],
};

/** The full name of a weekday, indexed by moment's `day()` (0 = Sunday). */
export function weekdayName(day: number): string {
  return WEEKDAY_NAMES[activeLanguage][((day % 7) + 7) % 7]!;
}

/** The short name of a weekday, indexed by moment's `day()` (0 = Sunday). */
export function weekdayShortName(day: number): string {
  return WEEKDAY_SHORT_NAMES[activeLanguage][((day % 7) + 7) % 7]!;
}

/** The short name of a month, indexed by month (0 = January). */
export function monthShortName(month: number): string {
  return MONTH_SHORT_NAMES[activeLanguage][((month % 12) + 12) % 12]!;
}

/** The moment locale to use for a language, when moment ships that locale. */
export function momentLocaleOf(language: LanguageCode): string {
  return language;
}
