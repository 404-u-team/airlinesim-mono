import type { OperationRoute } from "../types";
import type { TimelineBar } from "./schedule-types";
import type { ScheduleBlock } from "./useScheduleDrag";

/** A horizontal slice of a leg confined to a single day row, positioned on the UTC axis. */
export type DaySegment = { day: number; leftPct: number; widthPct: number; wrapped: boolean };

export function barEndPct(bar: TimelineBar): number {
  return Math.min(100, bar.leftPct + Math.max(bar.widthPct, 3));
}

export function barsConflict(leftBars: TimelineBar[], rightBars: TimelineBar[]): boolean {
  return leftBars.some((left) => rightBars.some((right) => barsOverlap(left, right)));
}

export function barsOverlap(left: TimelineBar, right: TimelineBar): boolean {
  return left.day === right.day && left.leftPct < barEndPct(right) && right.leftPct < barEndPct(left);
}

/**
 * Build the timeline bars for one block: an outbound and a return leg, each wrapping past 24:00.
 * Blocks store hub-local departure time; `utcOffsetHours` shifts them onto the UTC axis
 * BEFORE splitting, so the day-boundary wrap lands at the real UTC midnight.
 */
export function buildBlockBars(block: ScheduleBlock, route: OperationRoute | undefined, turnaroundMinutes: number, utcOffsetHours = 0): TimelineBar[] {
  const startHour = timeToHour(block.time) - utcOffsetHours;
  const hours = routeHours(route);
  const code = routeCode(route);
  const returnStart = startHour + hours + turnaroundMinutes / 60;

  return [
    ...legSegments(block.id, block.oneWay ? `${code} →` : code, "outbound", startHour, hours, block.day, block.saved),
    ...(block.oneWay
      ? []
      : legSegments(`${block.id}~r`, `${code} R`, "return", returnStart, hours, block.day, block.saved)),
  ];
}

export function routeCode(route: OperationRoute | undefined): string {
  if (!route) {
    return "—";
  }
  const origin = route.origin_airport?.iata_code ?? route.origin_airport?.label.slice(0, 3) ?? "???";
  const destination = route.destination_airport?.iata_code ?? route.destination_airport?.label.slice(0, 3) ?? "???";

  return `${origin}/${destination}`;
}

export function routeHours(route: OperationRoute | undefined): number {
  return Math.max(1, (route?.demand_snapshot.distance_km ?? 800) / 800 + 0.5);
}

/**
 * Split a leg that starts at `startHour` (hours from `day` 00:00 UTC; may be negative
 * or ≥ 24) and lasts `hours` into per-day segments, wrapping at each UTC midnight.
 * Single source of truth for day-boundary wrapping, shared by placed bars and drag previews.
 */
export function splitIntoDaySegments(startHour: number, hours: number, day: number): DaySegment[] {
  const segments: DaySegment[] = [];
  const dayShift = Math.floor(startHour / 24);
  let start = startHour - dayShift * 24; // normalised into [0, 24)
  let remaining = hours;
  let currentDay = (((day + dayShift) % 7) + 7) % 7;

  while (remaining > 0.01) {
    const end = Math.min(24, start + remaining);
    segments.push({
      day: currentDay,
      leftPct: (start / 24) * 100,
      widthPct: ((end - start) / 24) * 100,
      wrapped: segments.length > 0,
    });
    remaining -= end - start;
    start = 0;
    currentDay = (currentDay + 1) % 7;
  }

  return segments;
}

export function timeToHour(time: string): number {
  const [hour = "9", minute = "0"] = time.split(":");

  return Number(hour) + Number(minute) / 60;
}

function legSegments(
  id: string,
  label: string,
  tone: "outbound" | "return",
  startHour: number,
  hours: number,
  day: number,
  saved: boolean | undefined,
): TimelineBar[] {
  return splitIntoDaySegments(startHour, hours, day).map((seg) => ({
    day: seg.day,
    id: `${id}@${String(seg.day)}`,
    label,
    leftPct: seg.leftPct,
    saved,
    tone,
    widthPct: seg.widthPct,
    wrapped: seg.wrapped,
  }));
}
