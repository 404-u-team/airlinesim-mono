import type { AirTimelineItem } from "@airlinesim/air-ui";
import type { Locale } from "@airlinesim/i18n";

import type { FlightCard, OperationRoute } from "./types";

export function buildScheduleTimelineItems(
  flights: FlightCard[],
  locale: Locale,
  t: (key: string) => string,
  turnaroundMinutes: number,
): AirTimelineItem[] {
  if (flights.length < 2) {
    return [];
  }
  const outbound = flights[0];
  const inbound = flights[1];
  const items: AirTimelineItem[] = [
    flightTimelineItem("outbound", t("operations.leg.outbound"), outbound, locale, t),
    {
      detail: t("operations.turnaround.visual"),
      id: "turnaround",
      meta: `${String(turnaroundMinutes)} ${t("unit.minuteShort")}`,
      title: t("operations.turnaround"),
      tone: "warning",
    },
    flightTimelineItem("return", t("operations.leg.return"), inbound, locale, t),
  ];

  return items;
}

export function formatScheduleClock(value: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

export function routeLabel(route: OperationRoute): string {
  return `${route.origin_airport?.label ?? route.origin_airport_id} -> ${route.destination_airport?.label ?? route.destination_airport_id}`;
}

function flightDuration(flight: FlightCard, t: (key: string) => string): string {
  const minutes = Math.max(0, Math.round((new Date(flight.arrival_at).getTime() - new Date(flight.departure_at).getTime()) / 60_000));

  return `${String(Math.floor(minutes / 60))}${t("unit.hourShort")} ${String(minutes % 60)}${t("unit.minuteShort")}`;
}

function flightTimelineItem(
  id: string,
  title: string,
  flight: FlightCard,
  locale: Locale,
  t: (key: string) => string,
): AirTimelineItem {
  return {
    detail: `${flight.origin_airport_id} -> ${flight.destination_airport_id} · ${flightDuration(flight, t)}`,
    id,
    meta: `${formatScheduleClock(flight.departure_at, locale)}-${formatScheduleClock(flight.arrival_at, locale)}`,
    title,
    tone: "success",
  };
}
