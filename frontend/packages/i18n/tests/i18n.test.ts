import { expect, test } from "bun:test";

import {
  getLocaleLabel,
  getStoredLocale,
  normalizeLocale,
  translate,
} from "../src";

test("normalizes supported locales from language tags", () => {
  expect(normalizeLocale("ru-RU")).toBe("ru");
  expect(normalizeLocale("tr-TR")).toBe("en");
});

test("reads only supported stored locales", () => {
  expect(getStoredLocale({ getItem: () => "ru" })).toBe("ru");
  expect(getStoredLocale({ getItem: () => "de" })).toBeNull();
});

test("translates with default locale fallback", () => {
  const messages = {
    en: { greeting: "Hello" },
    ru: {},
  };

  expect(getLocaleLabel("ru")).toBe("RU");
  expect(translate(messages, "ru", "greeting")).toBe("Hello");
});
