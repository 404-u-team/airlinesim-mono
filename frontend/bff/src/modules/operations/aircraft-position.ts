import type { Aircraft } from "../fleet/types";
import type { StoredFlight } from "./types";

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
