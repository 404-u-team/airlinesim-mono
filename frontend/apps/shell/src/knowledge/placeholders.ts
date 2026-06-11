import type { Locale } from "@airlinesim/i18n";

import type { DashboardAirport, DashboardSummary } from "../dashboard/types";
import type { FuelPriceSnapshot } from "../fuel/types";

export type KnowledgeBadgeTone = "error" | "primary" | "success" | "warning";

export type KnowledgePlaceholders = {
  activeRoutes: string;
  aircraftCount: string;
  airlineName: string;
  alertsCount: string;
  balance: string;
  fuelPrice: string;
  hubCode: string;
  hubLabel: string;
  liveFlights: string;
  nextActionDescription: string;
  runwayLength: string;
  slotsLimit: string;
};

export type KnowledgeSegment =
  | { kind: "badge"; text: string; tone: KnowledgeBadgeTone }
  | { kind: "strong"; text: string }
  | { kind: "text"; text: string };

// Полные имена классов обязательны: динамическая конкатенация вида
// `bg-${color}-soft` не обнаруживается сканером Tailwind и стили не собираются.
const BADGE_TONE_CLASSES: Record<KnowledgeBadgeTone, string> = {
  error: "bg-error-bg text-on-error-soft border-error/25",
  primary: "bg-primary-soft text-on-primary-soft border-primary/25",
  success: "bg-success-bg text-on-success-soft border-success/25",
  warning: "bg-warning-bg text-on-warning-soft border-warning/25",
};

const PLACEHOLDER_TONES: Record<keyof KnowledgePlaceholders, "strong" | KnowledgeBadgeTone> = {
  activeRoutes: "primary",
  aircraftCount: "primary",
  airlineName: "primary",
  alertsCount: "error",
  balance: "success",
  fuelPrice: "success",
  hubCode: "primary",
  hubLabel: "strong",
  liveFlights: "primary",
  nextActionDescription: "primary",
  runwayLength: "warning",
  slotsLimit: "warning",
};

const NEXT_ACTION_DESCRIPTIONS: Partial<Record<string, Record<Locale, string>>> = {
  BUY_FIRST_AIRCRAFT: { en: "buy your first aircraft in Fleet & Ops", ru: "купите первый самолет во Fleet & Ops" },
  CREATE_SCHEDULE: { en: "create a flight schedule", ru: "создайте расписание полетов" },
  PLAN_FIRST_ROUTE: { en: "establish a new route in Route Planner", ru: "проложите маршрут в Route Planner" },
  VIEW_OPERATIONS: { en: "track active flight operations", ru: "отслеживайте выполняющиеся рейсы" },
};

export function buildKnowledgePlaceholders(
  locale: Locale,
  summary: DashboardSummary | null,
  fuelPrice: FuelPriceSnapshot | null,
): KnowledgePlaceholders {
  if (!summary) {
    return defaultPlaceholders(locale);
  }

  const airport = summary.base.status === "ready" ? summary.base.airport : null;

  return {
    activeRoutes: String(summary.routes.active_routes),
    aircraftCount: String(summary.fleet.total_aircraft),
    airlineName: summary.airline.name || "AirlineSim",
    alertsCount: String(summary.alerts.length),
    balance: formatMoney(summary.airline.balance, locale),
    fuelPrice: fuelPrice ? formatMoney(fuelPrice.unit_price, locale) : "$680",
    hubCode: hubCode(airport),
    hubLabel: (airport ? airport.label : localized(locale, "not selected", "не выбран")) || "N/A",
    liveFlights: String(summary.flights.live_flights),
    nextActionDescription: NEXT_ACTION_DESCRIPTIONS[summary.next_action.code]?.[locale] ?? summary.next_action.code,
    runwayLength: airportMetric(airport?.max_runway_length_m, locale, { en: "m", ru: "м" }),
    slotsLimit: airportMetric(airport?.max_runway_uses_per_day, locale, { en: "flights/day", ru: "рейсов/день" }),
  };
}

export function knowledgeBadgeClass(tone: KnowledgeBadgeTone): string {
  return `inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold font-mono border ${BADGE_TONE_CLASSES[tone]}`;
}

// Разбивает абзац статьи на сегменты: обычный текст и подстановки вида
// {balance}, отображаемые бейджами. Неизвестные плейсхолдеры остаются текстом.
export function knowledgeParagraphSegments(text: string, values: KnowledgePlaceholders): KnowledgeSegment[] {
  const segments: KnowledgeSegment[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(/\{(\w+)\}/gu)) {
    const key = match[1] as keyof KnowledgePlaceholders;
    const tone = PLACEHOLDER_TONES[key] as typeof PLACEHOLDER_TONES[keyof KnowledgePlaceholders] | undefined;

    if (!tone) {
      continue;
    }

    if (match.index > lastIndex) {
      segments.push({ kind: "text", text: text.slice(lastIndex, match.index) });
    }

    segments.push(tone === "strong" ? { kind: "strong", text: values[key] } : { kind: "badge", text: values[key], tone });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    segments.push({ kind: "text", text: text.slice(lastIndex) });
  }

  return segments;
}

function airportMetric(value: number | undefined, locale: Locale, unit: Record<Locale, string>): string {
  if (!value) {
    return "N/A";
  }

  return `${formatNumber(value, locale)} ${unit[locale]}`;
}

function defaultPlaceholders(locale: Locale): KnowledgePlaceholders {
  return {
    activeRoutes: "0",
    aircraftCount: "0",
    airlineName: "AirlineSim",
    alertsCount: "0",
    balance: localized(locale, "$10,000,000", "$10 000 000"),
    fuelPrice: "$680",
    hubCode: "ICN",
    hubLabel: localized(locale, "Seoul Incheon (ICN)", "Сеул Инчхон (ICN)"),
    liveFlights: "0",
    nextActionDescription: localized(locale, "buy your first aircraft", "купите первый самолет"),
    runwayLength: localized(locale, "3750m", "3750 м"),
    slotsLimit: localized(locale, "120/day", "120/день"),
  };
}

function formatMoney(value: number, locale: Locale): string {
  return new Intl.NumberFormat(locale, {
    currency: "USD",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(value);
}

function formatNumber(value: number, locale: Locale): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(value);
}

function hubCode(airport: DashboardAirport | null): string {
  if (!airport) {
    return "N/A";
  }

  if (airport.iata_code) {
    return airport.iata_code;
  }

  return airport.icao_code ?? "N/A";
}

function localized(locale: Locale, en: string, ru: string): string {
  return locale === "ru" ? ru : en;
}
