import type { Airport } from "../fleet/types";
import type { StoredFlight, StoredSchedule } from "../operations/types";
import type { StoredRoute } from "../routes/types";
import type { AirportConstraint, SlotCapacityDay, SlotCapacitySummary } from "./types";

import { constraint } from "./constraints";

const days = [0, 1, 2, 3, 4, 5, 6];

export function buildSlotCapacity(
  airport: Airport | undefined,
  routes: StoredRoute[],
  schedules: StoredSchedule[],
  flights: StoredFlight[],
  projectedUses: Partial<Record<number, number>> = {},
): SlotCapacitySummary {
  const capacity = Math.max(0, airport?.max_runway_uses_per_day ?? 0);
  const current = plannedUsesForAirport(airport, routes, schedules, flights);
  const slotDays = days.map((day) => toSlotDay(day, capacity, current[day] ?? 0, projectedUses[day] ?? 0));
  const busiest = [...slotDays].sort((left, right) => right.projected - left.projected)[0]?.day ?? 0;

  return {
    busiest_day: busiest,
    capacity_per_day: capacity,
    days: slotDays,
    model: "airline_planning_headroom",
    planned_uses_by_day: dayRecord(slotDays, "current"),
    remaining_by_day: dayRecord(slotDays, "remaining"),
    utilization_by_day: dayRecord(slotDays, "utilization"),
  };
}

export function slotCapacityConstraints(
  airport: Airport | undefined,
  slots: SlotCapacitySummary,
  targetPath = "/operations/schedule",
): AirportConstraint[] {
  const exceeded = slots.days.filter((day) => day.capacity > 0 && day.projected > day.capacity);
  const low = slots.days.filter((day) => day.capacity > 0 && day.projected >= day.capacity * 0.8 && day.projected <= day.capacity);

  return [
    ...exceeded.map((day) => slotConstraint("AIRPORT_SLOT_CAPACITY_EXCEEDED", true, airport, day, targetPath)),
    ...low.map((day) => slotConstraint("AIRPORT_SLOT_CAPACITY_LOW", false, airport, day, targetPath)),
  ];
}

function addMaterializedFlightUses(
  usage: Record<number, number>,
  airport: Airport | undefined,
  flights: StoredFlight[],
): void {
  for (const flight of representativeWeek(flights.filter(isPlannedFlight))) {
    if (flight.origin_airport_id === airport?.id) {
      increment(usage, localWeekday(flight.departure_at, airport.timezone));
    }
    if (flight.destination_airport_id === airport?.id) {
      increment(usage, localWeekday(flight.arrival_at, airport.timezone));
    }
  }
}

function addScheduleUses(
  usage: Record<number, number>,
  airportId: string | undefined,
  schedules: StoredSchedule[],
  routeById: Map<string, StoredRoute>,
  schedulesWithFlights: Set<string>,
): void {
  for (const schedule of schedules.filter((item) => item.status === "active" && !schedulesWithFlights.has(item.id))) {
    const route = routeById.get(schedule.route_id);
    if (route?.origin_airport_id === airportId || route?.destination_airport_id === airportId) {
      for (const day of schedule.pattern.days_of_week) {
        increment(usage, day);
      }
    }
  }
}

function dayRecord(slotDays: SlotCapacityDay[], key: "current" | "remaining" | "utilization"): Record<string, number> {
  return Object.fromEntries(slotDays.map((day) => [String(day.day), day[key]]));
}

function increment(record: Record<number, number>, day: number): void {
  record[day] = (record[day] ?? 0) + 1;
}

function isPlannedFlight(flight: StoredFlight): boolean {
  return flight.status !== "cancelled" && flight.status !== "completed";
}

function localWeekday(value: string, timeZone: string | undefined): number {
  if (!timeZone) {
    return new Date(value).getUTCDay();
  }

  try {
    const weekday = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short" }).format(new Date(value));

    return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(weekday);
  } catch {
    return new Date(value).getUTCDay();
  }
}

function plannedUsesForAirport(
  airport: Airport | undefined,
  routes: StoredRoute[],
  schedules: StoredSchedule[],
  flights: StoredFlight[],
): Record<number, number> {
  const usage: Record<number, number> = {};
  const activeScheduleIds = new Set(schedules.filter((schedule) => schedule.status === "active").map((schedule) => schedule.id));
  const schedulesWithFlights = new Set(flights.filter((flight) => activeScheduleIds.has(flight.schedule_id)).map((flight) => flight.schedule_id));
  const routeById = new Map(routes.map((route) => [route.id, route]));

  addScheduleUses(usage, airport?.id, schedules, routeById, schedulesWithFlights);
  addMaterializedFlightUses(usage, airport, flights);

  return usage;
}

function representativeWeek(flights: StoredFlight[]): StoredFlight[] {
  const bySchedule = Map.groupBy(flights, (flight) => flight.schedule_id);

  return Array.from(bySchedule.values()).flatMap((items) => {
    const sorted = items.toSorted((left, right) => left.departure_at.localeCompare(right.departure_at));
    const start = new Date(sorted[0]?.departure_at ?? 0).getTime();
    const end = start + 7 * 24 * 60 * 60_000;

    return sorted.filter((flight) => new Date(flight.departure_at).getTime() < end);
  });
}

function slotConstraint(
  code: "AIRPORT_SLOT_CAPACITY_EXCEEDED" | "AIRPORT_SLOT_CAPACITY_LOW",
  blocking: boolean,
  airport: Airport | undefined,
  day: SlotCapacityDay,
  targetPath: string,
): AirportConstraint {
  return constraint(code, blocking, {
    airport_id: airport?.id ?? "",
    capacity: day.capacity,
    current: day.current,
    day: day.day,
    projected: day.projected,
    remaining: day.remaining,
    utilization: day.utilization,
  }, targetPath, {
    airport_id: airport?.id,
  });
}

function toSlotDay(day: number, capacity: number, current: number, projectedIncrement: number): SlotCapacityDay {
  const projected = current + projectedIncrement;

  return {
    capacity,
    current,
    day,
    projected,
    remaining: capacity - projected,
    utilization: capacity > 0 ? projected / capacity : 0,
  };
}
