import type { AdminEntityConfig, AdminFormValues, AdminRecord } from "./types";

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

export function validateForm(config: AdminEntityConfig, values: AdminFormValues): null | string {
  const missingField = config.fields.find(
    (field) => field.required && !values[field.key].trim(),
  );

  if (missingField) {
    return `${missingField.label} is required.`;
  }

  const invalidNumberField = config.fields.find((field) => {
    const value = values[field.key].trim();

    return field.kind === "number" && Boolean(value) && Number.isNaN(Number(value));
  });

  if (invalidNumberField) {
    return `${invalidNumberField.label} must be a number.`;
  }

  return null;
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
