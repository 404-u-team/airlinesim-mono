import type { AirportConstraint } from "../facilities/types";
import type { Aircraft, AircraftType, Airport } from "../fleet/types";
import type { RoutePlanningSnapshot } from "../routes/planning";
import type { StoredRoute } from "../routes/types";
import type { OperationReason, SchedulePattern, SchedulePreview, StoredFlight, StoredSchedule } from "./types";

import { arrivalLocalDayOffset, arrivalLocalTime, nightOperationConstraints, rangeConstraints, runwayConstraints } from "../facilities/constraints";
import { buildSlotCapacity, slotCapacityConstraints } from "../facilities/slots";
import { estimateBlockHours, estimateUtilizationHours, estimateWeeklyCost, generateFlightsForSchedule, stableScheduleId, summarizeWeeklyEconomics } from "./flights";

export type OperationsSnapshot = RoutePlanningSnapshot & {
  flights: StoredFlight[];
  routes: StoredRoute[];
  schedules: StoredSchedule[];
};

type SchedulePreviewInput = {
  aircraft_id?: string;
  days_of_week?: number[];
  departure_local_time?: string;
  route_id?: string;
  starts_on?: string;
  turnaround_minutes?: number;
};

export function buildSchedulePreview(snapshot: OperationsSnapshot, input: SchedulePreviewInput): SchedulePreview {
  const route = snapshot.routes.find((item) => item.id === input.route_id);
  const aircraft = snapshot.aircrafts.find((item) => item.id === input.aircraft_id);
  const type = snapshot.aircraftTypes.find((item) => item.id === aircraft?.type_id);
  const origin = snapshot.airports.find((item) => item.id === route?.origin_airport_id);
  const destination = snapshot.airports.find((item) => item.id === route?.destination_airport_id);
  const days = normalizeDays(input.days_of_week);
  const pattern = buildPattern(days, input.departure_local_time, input.turnaround_minutes);
  const blockers = buildBlockers(snapshot, route, aircraft, type, origin, destination, pattern);
  const warnings = buildWarnings(snapshot, route, aircraft, type, origin, destination, pattern);
  const sampleFlights = blockers.length === 0 && route && aircraft && type && origin && destination
    ? generateFlightsForSchedule(snapshot, route, aircraft, type, pattern, input.starts_on, 7).slice(0, 5)
    : [];
  const weeklyEconomics = summarizeWeeklyEconomics(sampleFlights, days.length || 1);

  return {
    blockers,
    canActivate: blockers.length === 0,
    economics: weeklyEconomics,
    sample_flights: sampleFlights,
    warnings,
    weekly_utilization_hours: estimateUtilizationHours(route, type, days.length),
  };
}

export function createScheduleFromPreview(snapshot: OperationsSnapshot, input: SchedulePreviewInput, preview: SchedulePreview): {
  flights: StoredFlight[];
  schedule: StoredSchedule;
} {
  const route = snapshot.routes.find((item) => item.id === input.route_id);
  const aircraft = snapshot.aircrafts.find((item) => item.id === input.aircraft_id);
  const type = snapshot.aircraftTypes.find((item) => item.id === aircraft?.type_id);
  const days = normalizeDays(input.days_of_week);
  const pattern = buildPattern(days, input.departure_local_time, input.turnaround_minutes);
  const now = new Date().toISOString();
  const startsOn = input.starts_on ?? now.slice(0, 10);
  const scheduleId = stableScheduleId(route?.id ?? "", aircraft?.id, pattern, startsOn);

  if (!route || !aircraft || !type) {
    throw new Error("Cannot create schedule without route and aircraft.");
  }

  const schedule: StoredSchedule = {
    aircraft_id: aircraft.id ?? "",
    airline_id: snapshot.airline.id ?? "",
    checks_snapshot: [...preview.blockers, ...preview.warnings],
    created_at: now,
    id: scheduleId,
    pattern,
    route_id: route.id,
    status: preview.canActivate ? "active" : "draft",
    updated_at: now,
    validity: {
      starts_on: startsOn,
    },
  };
  const flights = preview.canActivate
    ? generateFlightsForSchedule(snapshot, route, aircraft, type, pattern, startsOn, 14, schedule.id)
    : [];

  return { flights, schedule };
}

function addAircraftBlockers(blockers: OperationReason[], aircraft: Aircraft | undefined): void {
  if (!aircraft) {
    addReason(blockers, "AIRCRAFT_NOT_FOUND", "Aircraft not found.");
  }
  if (aircraft?.status === "maintenance") {
    addReason(blockers, "AIRCRAFT_NOT_READY", "Aircraft is in maintenance.");
  }
}

function addCashWarning(
  warnings: OperationReason[],
  snapshot: OperationsSnapshot,
  route: StoredRoute | undefined,
  type: AircraftType | undefined,
  origin: Airport | undefined,
  destination: Airport | undefined,
  pattern: SchedulePattern,
): void {
  if ((snapshot.airline.balance ?? 0) < estimateWeeklyCost(route, type, origin, destination, pattern.days_of_week.length)) {
    addReason(warnings, "CASH_RESERVE_LOW", "Cash reserve may be low after the first week.");
  }
}

function addConflictBlockers(
  blockers: OperationReason[],
  snapshot: OperationsSnapshot,
  aircraft: Aircraft | undefined,
  pattern: SchedulePattern,
): void {
  if (aircraft && hasConflict(snapshot, aircraft.id ?? "", pattern)) {
    addReason(blockers, "AIRCRAFT_CONFLICT", "Aircraft is already scheduled at this time.");
  }
}

function addMaintenanceWarning(warnings: OperationReason[], aircraft: Aircraft | undefined): void {
  if (aircraft && maintenanceRatio(aircraft) < 0.35) {
    addReason(warnings, "AIRCRAFT_NOT_READY", "Aircraft maintenance reserve is low.");
  }
}

function addNightOpsWarning(
  blockers: OperationReason[],
  warnings: OperationReason[],
  route: StoredRoute | undefined,
  type: AircraftType | undefined,
  origin: Airport | undefined,
  destination: Airport | undefined,
  pattern: SchedulePattern,
): void {
  const arrivalTime = arrivalLocalTime(
    pattern.departure_local_time,
    estimateBlockHours(route, type),
    origin?.timezone,
    destination?.timezone,
  );
  const constraints = [
    ...nightOperationConstraints(origin, pattern.departure_local_time),
    ...(arrivalTime ? nightOperationConstraints(destination, arrivalTime) : nightOperationConstraints(destination, "12:00")),
  ];

  for (const item of constraints) {
    (item.blocking ? blockers : warnings).push(toOperationReason(item));
  }
}

function addOversupplyWarning(
  warnings: OperationReason[],
  route: StoredRoute | undefined,
  type: AircraftType | undefined,
  pattern: SchedulePattern,
): void {
  if (route && type) {
    const seatsPerWeek = (type.max_planned_seat_capacity ?? 100) * pattern.days_of_week.length;
    const demandPerWeek = route.demand_snapshot.origin_daily_passengers * 7;
    if (seatsPerWeek > demandPerWeek * 1.35) {
      addReason(warnings, "OVERSUPPLY_RISK", "Offered seats exceed expected demand.");
    }
  }
}

function addPatternBlockers(blockers: OperationReason[], pattern: SchedulePattern): void {
  if (!pattern.days_of_week.length) {
    addReason(blockers, "NO_DAYS_SELECTED", "Select at least one operating day.");
  }
}

function addPerformanceBlockers(
  blockers: OperationReason[],
  route: StoredRoute | undefined,
  type: AircraftType | undefined,
  origin: Airport | undefined,
  destination: Airport | undefined,
): void {
  blockers.push(
    ...rangeConstraints(route?.demand_snapshot.distance_km, type).map(toOperationReason),
    ...runwayConstraints(origin, type).map(toOperationReason),
    ...runwayConstraints(destination, type).map(toOperationReason),
  );
}

function addReason(reasons: OperationReason[], code: OperationReason["code"], message: string): void {
  reasons.push({ code, message });
}

function addRouteBlockers(blockers: OperationReason[], route: StoredRoute | undefined): void {
  if (!route) {
    addReason(blockers, "ROUTE_NOT_FOUND", "Route not found.");
  } else if (route.status !== "awaiting_schedule" && route.status !== "scheduled") {
    addReason(blockers, "ROUTE_NOT_READY", "Route is not ready for scheduling.");
  }
}

function addSlotConstraints(
  blockers: OperationReason[],
  snapshot: OperationsSnapshot,
  route: StoredRoute | undefined,
  type: AircraftType | undefined,
  origin: Airport | undefined,
  destination: Airport | undefined,
  pattern: SchedulePattern,
): void {
  blockers.push(...scheduleSlotConstraints(snapshot, route, type, origin, destination, pattern)
    .filter((item) => item.blocking)
    .map(toOperationReason));
}

function addSlotWarnings(
  warnings: OperationReason[],
  snapshot: OperationsSnapshot,
  route: StoredRoute | undefined,
  type: AircraftType | undefined,
  origin: Airport | undefined,
  destination: Airport | undefined,
  pattern: SchedulePattern,
): void {
  warnings.push(...scheduleSlotConstraints(snapshot, route, type, origin, destination, pattern)
    .filter((item) => !item.blocking)
    .map(toOperationReason));
}

function buildBlockers(
  snapshot: OperationsSnapshot,
  route: StoredRoute | undefined,
  aircraft: Aircraft | undefined,
  type: AircraftType | undefined,
  origin: Airport | undefined,
  destination: Airport | undefined,
  pattern: SchedulePattern,
): OperationReason[] {
  const blockers: OperationReason[] = [];

  addRouteBlockers(blockers, route);
  addAircraftBlockers(blockers, aircraft);
  addPatternBlockers(blockers, pattern);
  addPerformanceBlockers(blockers, route, type, origin, destination);
  addConflictBlockers(blockers, snapshot, aircraft, pattern);
  addNightOpsWarning(blockers, [], route, type, origin, destination, pattern);
  addSlotConstraints(blockers, snapshot, route, type, origin, destination, pattern);

  return blockers;
}

function buildPattern(
  days: number[],
  departureLocalTime = "09:00",
  turnaroundMinutes = 90,
): SchedulePattern {
  return {
    days_of_week: days,
    departure_local_time: departureLocalTime,
    mode: days.length >= 7 ? "daily" : "weekly",
    turnaround_minutes: turnaroundMinutes,
  };
}

function buildWarnings(
  snapshot: OperationsSnapshot,
  route: StoredRoute | undefined,
  aircraft: Aircraft | undefined,
  type: AircraftType | undefined,
  origin: Airport | undefined,
  destination: Airport | undefined,
  pattern: SchedulePattern,
): OperationReason[] {
  const warnings: OperationReason[] = [];

  addNightOpsWarning([], warnings, route, type, origin, destination, pattern);
  addSlotWarnings(warnings, snapshot, route, type, origin, destination, pattern);
  addOversupplyWarning(warnings, route, type, pattern);
  addCashWarning(warnings, snapshot, route, type, origin, destination, pattern);
  addMaintenanceWarning(warnings, aircraft);

  return warnings;
}

function hasConflict(snapshot: OperationsSnapshot, aircraftId: string, pattern: SchedulePattern): boolean {
  return snapshot.schedules.some(
    (schedule) =>
      schedule.status === "active" &&
      schedule.aircraft_id === aircraftId &&
      schedule.pattern.departure_local_time === pattern.departure_local_time &&
      schedule.pattern.days_of_week.some((day) => pattern.days_of_week.includes(day)),
  );
}

function maintenanceRatio(aircraft: Aircraft): number {
  const max = aircraft.max_maintenance_points_cached ?? 0;

  if (max <= 0) {
    return 1;
  }

  return Math.max(0, Math.min(1, (aircraft.current_maintenance_points ?? max) / max));
}

function normalizeDays(days: number[] | undefined): number[] {
  const normalized = (days?.length ? days : [1, 3, 5])
    .map((day) => Math.max(0, Math.min(6, day)))
    .filter((day) => Number.isFinite(day));

  return Array.from(new Set(normalized)).sort((left, right) => left - right);
}

function projectedUses(pattern: SchedulePattern, dayOffset = 0): Partial<Record<number, number>> {
  return Object.fromEntries(pattern.days_of_week.map((day) => [((day + dayOffset) % 7 + 7) % 7, 1]));
}

function scheduleSlotConstraints(
  snapshot: OperationsSnapshot,
  route: StoredRoute | undefined,
  type: AircraftType | undefined,
  origin: Airport | undefined,
  destination: Airport | undefined,
  pattern: SchedulePattern,
): AirportConstraint[] {
  const destinationOffset = arrivalLocalDayOffset(
    pattern.departure_local_time,
    estimateBlockHours(route, type),
    origin?.timezone,
    destination?.timezone,
  );

  return [
    ...slotCapacityConstraints(origin, buildSlotCapacity(origin, snapshot.routes, snapshot.schedules, snapshot.flights, projectedUses(pattern))),
    ...slotCapacityConstraints(destination, buildSlotCapacity(destination, snapshot.routes, snapshot.schedules, snapshot.flights, projectedUses(pattern, destinationOffset))),
  ];
}

function toOperationReason(item: AirportConstraint): OperationReason {
  return {
    code: item.code,
    message: item.code,
    parameters: item.parameters,
    target_path: item.target_path,
  };
}
