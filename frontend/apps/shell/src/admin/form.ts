import type { Locale } from "@airlinesim/i18n";

import type { AdminEntityConfig, AdminFieldKind, AdminFormValues, AdminRecord } from "./types";

import { localizeAdminLabel } from "./i18n";

export function createEmptyFormValues(config: AdminEntityConfig): AdminFormValues {
  return Object.fromEntries(
    config.fields.map((field) => [field.key, field.kind === "boolean" ? "false" : ""]),
  );
}

export function createFormValues(config: AdminEntityConfig, record: AdminRecord): AdminFormValues {
  return Object.fromEntries(
    config.fields.map((field) => {
      const value = record[field.key];

      if (field.kind === "boolean") {
        return [field.key, value === true ? "true" : "false"];
      }

      return [field.key, stringifyFormValue(value)];
    }),
  );
}

export function createPayload(
  config: AdminEntityConfig,
  values: AdminFormValues,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {};

  for (const field of config.fields) {
    const value = values[field.key].trim();

    if (!value && field.kind !== "boolean") {
      continue;
    }

    if (field.kind === "number") {
      payload[field.key] = Number(value);
      continue;
    }

    if (field.kind === "boolean") {
      payload[field.key] = value === "true";
      continue;
    }

    payload[field.key] = value;
  }

  return payload;
}

export function validateForm(config: AdminEntityConfig, values: AdminFormValues, locale: Locale = "en"): null | string {
  const missingField = config.fields.find(
    (field) => field.required && !values[field.key].trim(),
  );

  if (missingField) {
    return locale === "ru"
      ? `Поле «${localizeAdminLabel(locale, missingField.label)}» обязательно.`
      : `${missingField.label} is required.`;
  }

  const invalidNumberField = config.fields.find((field) => {
    const value = values[field.key].trim();

    return field.kind === "number" && Boolean(value) && Number.isNaN(Number(value));
  });

  if (invalidNumberField) {
    return locale === "ru"
      ? `Поле «${localizeAdminLabel(locale, invalidNumberField.label)}» должно быть числом.`
      : `${invalidNumberField.label} must be a number.`;
  }

  return validateEntityRules(config, values, locale);
}

function invalidScoreField(key: string, kind: AdminFieldKind, value: string): boolean {
  const scoreKeys = ["business", "diaspora", "tourism"];
  const isScore = key.endsWith("_score") || scoreKeys.includes(key);

  return kind === "number" && isScore && value !== "" && Number(value) > 1;
}

function localized(locale: Locale, en: string, ru: string): string {
  return locale === "ru" ? ru : en;
}

function stringifyFormValue(value: unknown): string {
  if (value === undefined || value === null) {
    return "";
  }

  if (typeof value === "boolean" || typeof value === "number" || typeof value === "string") {
    return String(value);
  }

  return JSON.stringify(value);
}

function validateEntityRules(config: AdminEntityConfig, values: AdminFormValues, locale: Locale): null | string {
  const identityError = validateIdentityRules(config, values, locale);
  if (identityError) {
    return identityError;
  }

  const negativeField = config.fields.find((field) =>
    field.kind === "number" && Number(values[field.key]) < 0,
  );
  if (negativeField) {
    return locale === "ru"
      ? `Поле «${localizeAdminLabel(locale, negativeField.label)}» не может быть отрицательным.`
      : `${negativeField.label} cannot be negative.`;
  }

  const scoreField = config.fields.find((field) => invalidScoreField(field.key, field.kind, values[field.key]));

  return scoreField
    ? localized(locale, `${scoreField.label} must be between 0 and 1.`, `Поле «${localizeAdminLabel(locale, scoreField.label)}» должно быть от 0 до 1.`)
    : null;
}

function validateIdentityRules(config: AdminEntityConfig, values: AdminFormValues, locale: Locale): null | string {
  if (config.id === "countries" && !/^[A-Z]{2}$/.test(values.iso.trim())) {
    return localized(locale, "ISO code must contain exactly two uppercase letters.", "ISO-код должен содержать ровно две заглавные буквы.");
  }
  if (config.id === "airports" && !/^[A-Z]{4}$/.test(values.icao_code.trim())) {
    return localized(locale, "ICAO code must contain exactly four uppercase letters.", "Код ICAO должен содержать ровно четыре заглавные буквы.");
  }
  if (config.id === "airports" && !/^[A-Z]{3}$/.test(values.iata_code.trim())) {
    return localized(locale, "IATA code must contain exactly three uppercase letters.", "Код IATA должен содержать ровно три заглавные буквы.");
  }
  if (config.id === "region-links" && values.region_a === values.region_b) {
    return localized(locale, "Region A and Region B must be different.", "Регион A и регион B должны различаться.");
  }

  return null;
}
