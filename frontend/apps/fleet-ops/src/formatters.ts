import type { Locale } from "@airlinesim/i18n";

export function formatMoneyValue(locale: Locale, value: number | undefined): string {
  return new Intl.NumberFormat(locale, {
    currency: "USD",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(value ?? 0);
}

export function formatNumberValue(locale: Locale, value: number | undefined): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(value ?? 0);
}

export function formatPercentValue(locale: Locale, value: number | undefined): string {
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: 0,
    style: "percent",
  }).format(value ?? 0);
}
