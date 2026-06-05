import type { Aircraft, AircraftType, Airport } from "../fleet/types";
import type { StoredRoute } from "../routes/types";
import type { OperationsSnapshot } from "./planning";
import type { FlightFinancials, SchedulePattern, SchedulePreview, StoredFlight } from "./types";

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

export function estimateUtilizationHours(route: StoredRoute | undefined, type: AircraftType | undefined, daysPerWeek: number): number {
  return Number((estimateBlockHours(route, type) * Math.max(daysPerWeek, 0)).toFixed(1));
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

  return estimateFlightFinancials(route, type, origin, destination, daysPerWeek).cost * daysPerWeek;
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

  return buildScheduleDates(startsOn, pattern, daysToGenerate)
    .map((departureAt, index) =>
      buildStoredFlight(snapshot, route, aircraft, type, pattern, origin, destination, departureAt, index, scheduleId));
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
  const sourceFlights = sampleFlights.slice(0, Math.max(daysPerWeek, 1));
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

function buildDepartureDate(date: Date, time: string): Date {
  const [hour = "9", minute = "0"] = time.split(":");
  const next = new Date(date);
  next.setUTCHours(Number(hour), Number(minute), 0, 0);

  return next;
}

function buildFlightNumber(snapshot: OperationsSnapshot, route: StoredRoute, index: number): string {
  const prefix = getAirlinePrefix(snapshot.airline.name);
  const routeSeed = Math.abs(hashCode(route.id)).toString().slice(0, 2).padStart(2, "1");

  return `${prefix}${routeSeed}${String(index + 1).padStart(2, "0")}`;
}

function buildScheduleDates(startsOn: string | undefined, pattern: SchedulePattern, daysToGenerate: number): Date[] {
  const firstDay = new Date(`${startsOn ?? new Date().toISOString().slice(0, 10)}T00:00:00.000Z`);
  const dates: Date[] = [];

  for (let offset = 0; offset < daysToGenerate; offset += 1) {
    const date = new Date(firstDay);
    date.setUTCDate(firstDay.getUTCDate() + offset);

    if (pattern.days_of_week.includes(date.getUTCDay())) {
      dates.push(buildDepartureDate(date, pattern.departure_local_time));
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
  scheduleId?: string,
): StoredFlight {
  const arrivalAt = new Date(departureAt.getTime() + estimateBlockHours(route, type) * 60 * 60_000);
  const expected = estimateFlightFinancials(route, type, origin, destination, pattern.days_of_week.length);
  const resolvedScheduleId = scheduleId ?? stableScheduleId(route.id, aircraft.id, pattern, undefined);
  const flightId = stableFlightId(resolvedScheduleId, departureAt);

  return {
    aircraft_id: aircraft.id ?? "",
    airline_id: snapshot.airline.id ?? "",
    arrival_at: arrivalAt.toISOString(),
    created_at: new Date().toISOString(),
    departure_at: departureAt.toISOString(),
    destination_airport_id: route.destination_airport_id,
    expected,
    flight_number: buildFlightNumber(snapshot, route, index),
    id: flightId,
    origin_airport_id: route.origin_airport_id,
    route_id: route.id,
    schedule_id: resolvedScheduleId,
    status: currentFlightStatus({ ...newFlightStub(route, aircraft, expected, flightId, departureAt, arrivalAt), status: "scheduled" }),
    updated_at: new Date().toISOString(),
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function estimateFlightFinancials(route: StoredRoute, type: AircraftType, origin: Airport, destination: Airport, daysPerWeek: number): FlightFinancials {
  const seats = type.max_planned_seat_capacity ?? 100;
  const demandPerFlight = (route.demand_snapshot.origin_daily_passengers * 7) / Math.max(daysPerWeek, 1);
  const loadFactor = clamp(demandPerFlight / Math.max(seats, 1), 0.35, 0.95);
  const passengers = Math.round(seats * loadFactor);
  const revenue = Math.round(route.economics_snapshot.estimated_fare_per_passenger * passengers);
  const blockHours = estimateBlockHours(route, type);
  const cost = Math.round(
    (type.fuel_consumption_per_hour ?? 2.8) * blockHours * 950 +
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

function stableFlightId(scheduleId: string, departureAt: Date): string {
  return `flight-${Math.abs(hashCode(`${scheduleId}|${departureAt.toISOString()}`)).toString(36)}`;
}
