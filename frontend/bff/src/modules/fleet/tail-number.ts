import type { Aircraft, Country } from "./types";

export type TailNumberValidation = {
  conflict: boolean;
  message?: string;
  normalizedValue: string;
  suggestedPrefix?: string;
  valid: boolean;
};

const tailNumberPattern = /^[A-Z0-9-]{2,12}$/;

export function normalizeTailNumber(value: string | undefined): string {
  return (value ?? "").trim().toUpperCase();
}

export function validateTailNumber(
  value: string | undefined,
  aircrafts: Aircraft[],
  country?: Country,
  ignoreAircraftId?: string,
): TailNumberValidation {
  const normalizedValue = normalizeTailNumber(value);
  const suggestedPrefix = country?.aircraft_tail_code ?? country?.iso;

  if (!normalizedValue) {
    return {
      conflict: false,
      message: "Tail number is required.",
      normalizedValue,
      suggestedPrefix,
      valid: false,
    };
  }

  if (!tailNumberPattern.test(normalizedValue)) {
    return {
      conflict: false,
      message: "Tail number must be 2-12 characters and use letters, numbers or hyphen.",
      normalizedValue,
      suggestedPrefix,
      valid: false,
    };
  }

  const conflict = aircrafts.some(
    (aircraft) =>
      aircraft.id !== ignoreAircraftId &&
      normalizeTailNumber(aircraft.tail_number) === normalizedValue,
  );

  if (conflict) {
    return {
      conflict: true,
      message: "Tail number already exists.",
      normalizedValue,
      suggestedPrefix,
      valid: false,
    };
  }

  return {
    conflict: false,
    normalizedValue,
    suggestedPrefix,
    valid: true,
  };
}
