export const DEFAULT_LOCALE = "en";
export const LOCALE_STORAGE_KEY = "airlinesim:locale";
export const SUPPORTED_LOCALES = ["en", "ru"] as const;

export type Locale = (typeof SUPPORTED_LOCALES)[number];
export type LocaleMessages<TKey extends string = string> = Record<
  Locale,
  Readonly<Partial<Record<TKey, string>>>
>;
type LocaleStorage = {
  getItem: (key: string) => null | string;
};

export function getLocaleLabel(locale: Locale): string {
  return locale === "ru" ? "RU" : "EN";
}

export function getStoredLocale(storage: LocaleStorage | null | undefined): Locale | null {
  const storedLocale = storage?.getItem(LOCALE_STORAGE_KEY);

  return isLocale(storedLocale) ? storedLocale : null;
}

export function isLocale(value: unknown): value is Locale {
  return (
    typeof value === "string" &&
    SUPPORTED_LOCALES.includes(value.toLowerCase() as Locale)
  );
}

export function normalizeLocale(value: unknown, fallback: Locale = DEFAULT_LOCALE): Locale {
  if (typeof value !== "string") {
    return fallback;
  }

  const language = value.toLowerCase().split("-")[0];

  return isLocale(language) ? language : fallback;
}
export function translate<TKey extends string>(
  messages: LocaleMessages<TKey>,
  locale: Locale,
  key: TKey,
): string {
  return messages[locale][key] ?? messages[DEFAULT_LOCALE][key] ?? key;
}
