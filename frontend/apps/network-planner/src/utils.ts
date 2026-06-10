import type { Locale } from "@airlinesim/i18n";

import type { NetworkMessageKey } from "./i18n";
import type { RouteOpportunity } from "./types";

const tMap: Record<string, boolean> = {
  "status.active": true,
  "status.awaiting_schedule": true,
  "status.draft": true,
  "status.paused": true,
  "status.scheduled": true,
};

export function errorMessage(value: unknown, fallback: string): string {
  return value instanceof Error ? value.message : fallback;
}

export function formatMoney(locale: Locale, value: number | undefined): string {
  return new Intl.NumberFormat(locale, {
    currency: "USD",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(value ?? 0);
}

export function formatNumber(locale: Locale, value: number | undefined): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(value ?? 0);
}

export function parseFare(value: string): number | undefined {
  const parsed = Number(value);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

export function recommendationLabel(value: RouteOpportunity["recommendation"], translate: (key: NetworkMessageKey) => string): string {
  return translate(`recommendation.${value}`);
}

export function recommendationVariant(value: RouteOpportunity["recommendation"]): "danger-soft" | "success-soft" | "warning-soft" {
  if (value === "open") {
    return "success-soft";
  }
  if (value === "blocked") {
    return "danger-soft";
  }

  return "warning-soft";
}

export function statusLabel(status: string, translate: (key: NetworkMessageKey) => string): string {
  const key = `status.${status}` as NetworkMessageKey;

  return key in tMap ? translate(key) : status;
}
