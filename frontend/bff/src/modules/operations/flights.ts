import type { Aircraft, AircraftType, Airport } from "../fleet/types";
import type { StoredRoute } from "../routes/types";
import type { OperationsSnapshot } from "./planning";
import type { FlightFinancials, SchedulePattern, SchedulePreview, StoredFlight } from "./types";

import { getCurrentFuelUnitPrice } from "../fuel/price";
import { zonedWallTimeToUtc } from "./schedule-time";

type FlightLeg = "outbound" | "return";

// Builds a single one-way "ferry" flight (e.g. to reposition an aircraft between
// hubs). It still carries passengers: load is computed from one day's worth of the
// pair's demand. Not tied to a recurring schedule — `schedule_id` is a one-off id.
export function buildOneTimeFlight(
  snapshot: OperationsSnapshot,
  route: StoredRoute,
  aircraft: Aircraft,
  type: AircraftType,
  origin: Airport,
  destination: Airport,
  departureAt: Date,
): StoredFlight {
  const arrivalAt = new Date(departureAt.getTime() + estimateBlockHours(route, type) * 60 * 60_000);
  const expected = estimateFlightFinancials(route, type, origin, destination, 7, "outbound");
  const scheduleId = `ferry-${crypto.randomUUID()}`;
  const flightId = stableFlightId(scheduleId, departureAt);

  return {
    aircraft_id: aircraft.id ?? "",
    airline_id: snapshot.airline.id ?? "",
    arrival_at: arrivalAt.toISOString(),
    created_at: new Date().toISOString(),
    departure_at: departureAt.toISOString(),
    destination_airport_id: destination.id ?? route.destination_airport_id,
    expected,
    flight_number: `${buildFlightNumber(snapshot, route, 0)}F`,
    id: flightId,
    origin_airport_id: origin.id ?? route.origin_airport_id,
    route_id: route.id,
    schedule_id: scheduleId,
    status: currentFlightStatus({ ...newFlightStub(route, aircraft, expected, flightId, departureAt, arrivalAt), status: "scheduled" }),
    updated_at: new Date().toISOString(),
  };
}

export function currentFlightStatus(flight: StoredFlight, now = new Date()): StoredFlight["status"] {
  if (flight.status === "cancelled" || flight.status === "completed") {
    return flight.status;
  }

  const departure = new Date(flight.departure_at);
  const arrival = new Date(flight.arrival_at);
  const boarding = new Date(departure.getTime() - 30 * 60_000);

  if (now >= arrival) {
    return "completed";
  }
  if (now >= departure) {
    return "in_flight";
  }
  if (now >= boarding) {
    return "boarding";
  }

  return "scheduled";
}

export function estimateBlockHours(route: StoredRoute | undefined, type: AircraftType | undefined): number {
  return Math.max(0.75, (route?.demand_snapshot.distance_km ?? 900) / (type?.cruising_speed_kph ?? 740) + 0.35);
}

export function estimateUtilizationHours(
  route: StoredRoute | undefined,
  type: AircraftType | undefined,
  daysPerWeek: number,
  turnaroundMinutes = 0,
): number {
  return Number((roundTripHours(route, type, turnaroundMinutes) * Math.max(daysPerWeek, 0)).toFixed(1));
}

export function estimateWeeklyCost(
  route: StoredRoute | undefined,
  type: AircraftType | undefined,
  origin: Airport | undefined,
  destination: Airport | undefined,
  daysPerWeek: number,
): number {
  if (!route || !type || !origin || !destination) {
    return 0;
  }

  const outbound = estimateFlightFinancials(route, type, origin, destination, daysPerWeek, "outbound");
  const inbound = estimateFlightFinancials(route, type, destination, origin, daysPerWeek, "return");

  return (outbound.cost + inbound.cost) * daysPerWeek;
}

export function generateFlightsForSchedule(
  snapshot: OperationsSnapshot,
  route: StoredRoute,
  aircraft: Aircraft,
  type: AircraftType,
  pattern: SchedulePattern,
  startsOn: string | undefined,
  daysToGenerate: number,
  scheduleId?: string,
): StoredFlight[] {
  const origin = snapshot.airports.find((item) => item.id === route.origin_airport_id);
  const destination = snapshot.airports.find((item) => item.id === route.destination_airport_id);

  if (!origin || !destination) {
    return [];
  }

  return buildScheduleDates(startsOn, pattern, daysToGenerate, origin.timezone)
    .flatMap((departureAt, index) =>
      buildRoundTripFlights(snapshot, route, aircraft, type, pattern, origin, destination, departureAt, index, scheduleId));
}

// Recomputes a flight's expected financials from current route economics and fuel
// price. Stored `expected` is a frozen creation-time estimate; flights generated
// before an economics change (e.g. the fuel price fix) otherwise keep stale numbers.
export function recomputeFlightExpected(flight: StoredFlight, snapshot: OperationsSnapshot): StoredFlight {
  const route = snapshot.routes.find((item) => item.id === flight.route_id);
  const aircraft = snapshot.aircrafts.find((item) => item.id === flight.aircraft_id);
  const type = snapshot.aircraftTypes.find((item) => item.id === aircraft?.type_id);
  const origin = snapshot.airports.find((item) => item.id === flight.origin_airport_id);
  const destination = snapshot.airports.find((item) => item.id === flight.destination_airport_id);

  if (!route || !type || !origin || !destination) {
    return flight;
  }

  const schedule = snapshot.schedules.find((item) => item.id === flight.schedule_id);
  const daysPerWeek = schedule?.pattern.days_of_week.length ?? 3;

  const leg = flight.origin_airport_id === route.destination_airport_id ? "return" : "outbound";

  return { ...flight, expected: estimateFlightFinancials(route, type, origin, destination, daysPerWeek, leg) };
}

export function stableScheduleId(
  routeId: string,
  aircraftId: string | undefined,
  pattern: SchedulePattern,
  startsOn: string | undefined,
): string {
  const seed = [
    routeId,
    aircraftId ?? "",
    startsOn ?? "",
    pattern.departure_local_time,
    pattern.turnaround_minutes,
    pattern.days_of_week.join(","),
  ].join("|");

  return `schedule-${Math.abs(hashCode(seed)).toString(36)}`;
}

export function summarizeWeeklyEconomics(sampleFlights: StoredFlight[], daysPerWeek: number): SchedulePreview["economics"] {
  const sourceFlights = sampleFlights.slice(0, Math.max(daysPerWeek * 2, 1));
  const weeklyRevenue = sourceFlights.reduce((total, flight) => total + flight.expected.revenue, 0);
  const weeklyCost = sourceFlights.reduce((total, flight) => total + flight.expected.cost, 0);

  return {
    weekly_cost: weeklyCost,
    weekly_profit: weeklyRevenue - weeklyCost,
    weekly_revenue: weeklyRevenue,
  };
}

export function updateFlightStatuses(flights: StoredFlight[], now = new Date()): StoredFlight[] {
  return flights.map((flight) => ({
    ...flight,
    status: currentFlightStatus(flight, now),
    updated_at: new Date().toISOString(),
  }));
}

function buildDepartureDate(date: Date, time: string, timeZone?: string): Date {
  const [hour = "9", minute = "0"] = time.split(":");

  return zonedWallTimeToUtc(date, Number(hour), Number(minute), timeZone);
}

function buildFlightNumber(snapshot: OperationsSnapshot, route: StoredRoute, index: number): string {
  const prefix = getAirlinePrefix(snapshot.airline.name);
  const routeSeed = Math.abs(hashCode(route.id)).toString().slice(0, 2).padStart(2, "1");

  return `${prefix}${routeSeed}${String(index + 1).padStart(2, "0")}`;
}

function buildRoundTripFlights(
  snapshot: OperationsSnapshot,
  route: StoredRoute,
  aircraft: Aircraft,
  type: AircraftType,
  pattern: SchedulePattern,
  origin: Airport,
  destination: Airport,
  departureAt: Date,
  index: number,
  scheduleId?: string,
): StoredFlight[] {
  const outbound = buildStoredFlight(
    snapshot,
    route,
    aircraft,
    type,
    pattern,
    origin,
    destination,
    departureAt,
    index,
    "outbound",
    scheduleId,
  );

  if (!pattern.round_trip) {
    return [outbound];
  }

  const returnDeparture = new Date(new Date(outbound.arrival_at).getTime() + pattern.turnaround_minutes * 60_000);
  const inbound = buildStoredFlight(
    snapshot,
    route,
    aircraft,
    type,
    pattern,
    destination,
    origin,
    returnDeparture,
    index,
    "return",
    scheduleId,
  );

  return [outbound, inbound];
}

function buildScheduleDates(
  startsOn: string | undefined,
  pattern: SchedulePattern,
  daysToGenerate: number,
  originTimeZone?: string,
): Date[] {
  const firstDay = new Date(`${startsOn ?? new Date().toISOString().slice(0, 10)}T00:00:00.000Z`);
  const dates: Date[] = [];

  for (let offset = 0; offset < daysToGenerate; offset += 1) {
    const date = new Date(firstDay);
    date.setUTCDate(firstDay.getUTCDate() + offset);

    if (pattern.days_of_week.includes(date.getUTCDay())) {
      dates.push(buildDepartureDate(date, pattern.departure_local_time, originTimeZone));
    }
  }

  return dates;
}

function buildStoredFlight(
  snapshot: OperationsSnapshot,
  route: StoredRoute,
  aircraft: Aircraft,
  type: AircraftType,
  pattern: SchedulePattern,
  origin: Airport,
  destination: Airport,
  departureAt: Date,
  index: number,
  leg: FlightLeg,
  scheduleId?: string,
): StoredFlight {
  const arrivalAt = new Date(departureAt.getTime() + estimateBlockHours(route, type) * 60 * 60_000);
  const expected = estimateFlightFinancials(route, type, origin, destination, pattern.days_of_week.length, leg);
  const resolvedScheduleId = scheduleId ?? stableScheduleId(route.id, aircraft.id, pattern, undefined);
  const flightId = stableFlightId(resolvedScheduleId, departureAt);

  return {
    aircraft_id: aircraft.id ?? "",
    airline_id: snapshot.airline.id ?? "",
    arrival_at: arrivalAt.toISOString(),
    created_at: new Date().toISOString(),
    departure_at: departureAt.toISOString(),
    destination_airport_id: destination.id ?? route.destination_airport_id,
    expected,
    flight_number: leg === "return" ? `${buildFlightNumber(snapshot, route, index)}R` : buildFlightNumber(snapshot, route, index),
    id: flightId,
    origin_airport_id: origin.id ?? route.origin_airport_id,
    route_id: route.id,
    schedule_id: resolvedScheduleId,
    status: currentFlightStatus({ ...newFlightStub(route, aircraft, expected, flightId, departureAt, arrivalAt), status: "scheduled" }),
    updated_at: new Date().toISOString(),
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function estimateFlightFinancials(
  route: StoredRoute,
  type: AircraftType,
  origin: Airport,
  destination: Airport,
  daysPerWeek: number,
  leg: FlightLeg,
): FlightFinancials {
  const seats = type.max_planned_seat_capacity ?? 100;
  const dailyDemand = leg === "return"
    ? route.demand_snapshot.destination_daily_passengers
    : route.demand_snapshot.origin_daily_passengers;
  const demandPerFlight = (dailyDemand * 7) / Math.max(daysPerWeek, 1);
  const loadFactor = clamp(demandPerFlight / Math.max(seats, 1), 0.35, 0.95);
  const passengers = Math.round(seats * loadFactor);
  const revenue = Math.round(route.economics_snapshot.estimated_fare_per_passenger * passengers);
  const blockHours = estimateBlockHours(route, type);
  const cost = Math.round(
    // fuel_consumption_per_hour is kg/h; the fuel unit price is per tonne, so convert.
    ((type.fuel_consumption_per_hour ?? 2000) / 1000) * blockHours * getCurrentFuelUnitPrice() +
      (type.maint_cost_per_flight_hour ?? 600) * blockHours +
      (origin.runway_fee ?? 0) +
      (origin.gate_fee ?? 0) +
      (destination.runway_fee ?? 0) +
      (destination.stand_fee ?? 0),
  );

  return {
    cost,
    load_factor: Number(loadFactor.toFixed(2)),
    passengers,
    profit: revenue - cost,
    revenue,
  };
}

function getAirlinePrefix(name: string | undefined): string {
  const normalized = name?.slice(0, 2).toUpperCase().replace(/[^A-Z]/g, "");

  return normalized && normalized.length > 0 ? normalized : "AS";
}

function hashCode(value: string): number {
  return value.split("").reduce((hash, char) => (hash << 5) - hash + char.charCodeAt(0), 0);
}

function newFlightStub(
  route: StoredRoute,
  aircraft: Aircraft,
  expected: FlightFinancials,
  stableKey: string,
  departureAt: Date,
  arrivalAt: Date,
): StoredFlight {
  return {
    aircraft_id: aircraft.id ?? "",
    airline_id: "",
    arrival_at: arrivalAt.toISOString(),
    created_at: new Date().toISOString(),
    departure_at: departureAt.toISOString(),
    destination_airport_id: route.destination_airport_id,
    expected,
    flight_number: "",
    id: stableKey,
    origin_airport_id: route.origin_airport_id,
    route_id: route.id,
    schedule_id: stableKey,
    status: "scheduled",
    updated_at: new Date().toISOString(),
  };
}

function roundTripHours(route: StoredRoute | undefined, type: AircraftType | undefined, turnaroundMinutes: number): number {
  return estimateBlockHours(route, type) * 2 + turnaroundMinutes / 60;
}

function stableFlightId(scheduleId: string, departureAt: Date): string {
  return `flight-${Math.abs(hashCode(`${scheduleId}|${departureAt.toISOString()}`)).toString(36)}`;
}

