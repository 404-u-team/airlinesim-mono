import type { OperationsSnapshot } from "./planning";
import type { StoredFlight } from "./types";

export type FlightWithAirports = StoredFlight & {
  destination_airport: FlightAirportRef;
  origin_airport: FlightAirportRef;
};

type FlightAirportRef = { iata_code?: string; label: string };

/** Attach human-readable origin/destination airport refs (IATA + name) to flights. */
export function attachAirportRefs(flights: StoredFlight[], airports: OperationsSnapshot["airports"]): FlightWithAirports[] {
  const byId = new Map(airports.map((airport) => [airport.id, airport]));

  return flights.map((flight) => ({
    ...flight,
    destination_airport: airportRef(byId.get(flight.destination_airport_id), flight.destination_airport_id),
    origin_airport: airportRef(byId.get(flight.origin_airport_id), flight.origin_airport_id),
  }));
}

function airportRef(airport: OperationsSnapshot["airports"][number] | undefined, fallbackId: string): FlightAirportRef {
  if (!airport) {
    return { label: fallbackId };
  }

  return {
    iata_code: airport.iata_code,
    label: `${airport.iata_code ?? airport.icao_code ?? "----"} - ${airport.intl_name ?? airport.local_name ?? "Airport"}`,
  };
}
