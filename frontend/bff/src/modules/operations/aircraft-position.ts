import type { Aircraft } from "../fleet/types";
import type { StoredFlight } from "./types";

import { currentFlightStatus } from "./flights";

// Flags flights whose aircraft will not physically be at the departure airport when
// the flight is due out (e.g. a ferry leg repositioned it). Pure read-time check.
export function annotateOutOfPosition(
  flights: StoredFlight[],
  aircrafts: Aircraft[],
  fallbackBaseAirportId: string | undefined,
): StoredFlight[] {
  const baseByAircraft = new Map(aircrafts.map((aircraft) => [aircraft.id, aircraft.base_airport_id ?? fallbackBaseAirportId]));

  return flights.map((flight) => {
    if (flight.status === "cancelled") {
      return flight;
    }
    const positionBefore = positionBeforeFlight(flight, flights, baseByAircraft.get(flight.aircraft_id));

    return { ...flight, out_of_position: Boolean(positionBefore) && positionBefore !== flight.origin_airport_id };
  });
}

// Derives where an aircraft physically is, based on the destination of its most
// recently arrived (non-cancelled) flight, defaulting to its base. Used to block
// scheduling a route whose origin the aircraft cannot reach without repositioning.
export function currentAircraftAirport(
  aircraftId: string,
  flights: StoredFlight[],
  baseAirportId: string | undefined,
  now = new Date(),
): string | undefined {
  const arrived = flights
    .filter((flight) =>
      flight.aircraft_id === aircraftId &&
      flight.status !== "cancelled" &&
      new Date(flight.arrival_at).getTime() <= now.getTime())
    .sort((left, right) => left.arrival_at.localeCompare(right.arrival_at));

  return arrived.at(-1)?.destination_airport_id ?? baseAirportId;
}

// Where the aircraft will physically end up once every kept (non-cancelled) flight in
// `flights` has been flown: destination of the latest flight by arrival, else the base.
// Unlike `currentAircraftAirport` it also counts flights that have not arrived yet, so
// a schedule replaced mid-rotation validates against the post-rotation position.
export function projectedAircraftAirport(
  aircraftId: string,
  flights: StoredFlight[],
  baseAirportId: string | undefined,
): string | undefined {
  const flown = flights
    .filter((flight) => flight.aircraft_id === aircraftId && flight.status !== "cancelled")
    .sort((left, right) => left.arrival_at.localeCompare(right.arrival_at));

  return flown.at(-1)?.destination_airport_id ?? baseAirportId;
}

// Flights of the aircraft's rotation already in progress that must survive a schedule
// replacement: anything that has pushed back (or is boarding) plus the chained legs of
// the same schedule that continue from where a protected leg lands within 24h — i.e.
// the return leg that brings the aircraft home. Cancelling these would strand the
// aircraft at an outstation.
export function rotationProtectedFlights(
  aircraftId: string,
  flights: StoredFlight[],
  now = new Date(),
): StoredFlight[] {
  const own = flights.filter((flight) => flight.aircraft_id === aircraftId && flight.status !== "cancelled");
  const protectedIds = new Set(
    own
      .filter((flight) => {
        const status = currentFlightStatus(flight, now);
        return status === "boarding" || status === "in_flight";
      })
      .map((flight) => flight.id),
  );

  // Chain forward: a still-scheduled leg continuing a protected leg is protected too.
  let changed = protectedIds.size > 0;
  while (changed) {
    changed = false;
    for (const candidate of own) {
      if (protectedIds.has(candidate.id)) {
        continue;
      }
      const continuesProtectedLeg = own.some((previous) =>
        protectedIds.has(previous.id) &&
        previous.schedule_id === candidate.schedule_id &&
        candidate.origin_airport_id === previous.destination_airport_id &&
        candidate.departure_at >= previous.arrival_at &&
        new Date(candidate.departure_at).getTime() - new Date(previous.arrival_at).getTime() <= 24 * 60 * 60_000);
      if (continuesProtectedLeg) {
        protectedIds.add(candidate.id);
        changed = true;
      }
    }
  }

  return own.filter((flight) => protectedIds.has(flight.id));
}

// Where the aircraft is right before `flight` departs: destination of its latest
// other non-cancelled flight that arrives by then, else the aircraft's base.
function positionBeforeFlight(
  flight: StoredFlight,
  flights: StoredFlight[],
  baseAirportId: string | undefined,
): string | undefined {
  const departure = new Date(flight.departure_at).getTime();
  const prior = flights
    .filter((other) =>
      other.id !== flight.id &&
      other.aircraft_id === flight.aircraft_id &&
      other.status !== "cancelled" &&
      new Date(other.arrival_at).getTime() <= departure)
    .sort((left, right) => left.arrival_at.localeCompare(right.arrival_at));

  return prior.at(-1)?.destination_airport_id ?? baseAirportId;
}
