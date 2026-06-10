// Read-side flight enrichment: resolves a stored flight against the snapshot and adds
// synthesized telemetry (phase/FL/speed/fuel/pax/ETA), airport coordinates and an
// aircraft summary. Shared by the live-flight list and the single-flight detail page.

import type { OperationsSnapshot } from "./planning";
import type { StoredFlight } from "./types";

import { pointFromAirport } from "../routes/geometry";
import { flightTelemetry, type FlightTelemetry } from "./flight-phases";

export type FlightAircraftSummary = { id: string; model_name?: string; seats?: number; tail_number?: string };

export type FlightCoordinates = { latitude: number; longitude: number };

export type FlightTelemetryRefs = {
  destination_coordinates: FlightCoordinates | null;
  origin_coordinates: FlightCoordinates | null;
  telemetry: FlightTelemetry;
};

// Lightweight aircraft summary for the flight detail header (model, tail, seat count).
export function flightAircraftSummary(flight: StoredFlight, snapshot: OperationsSnapshot): FlightAircraftSummary | null {
  const aircraft = snapshot.aircrafts.find((item) => item.id === flight.aircraft_id);

  if (!aircraft) {
    return null;
  }
  const type = snapshot.aircraftTypes.find((item) => item.id === aircraft.type_id);

  return {
    id: aircraft.id ?? "",
    model_name: type?.model_name,
    seats: type?.max_planned_seat_capacity,
    tail_number: aircraft.tail_number,
  };
}

// Telemetry for a single flight, resolving distance/speed/burn/pax from the snapshot.
// The realised passenger count (once departed) takes precedence over the estimate.
export function flightTelemetryFor(flight: StoredFlight, snapshot: OperationsSnapshot, now = new Date()): FlightTelemetryRefs {
  const route = snapshot.routes.find((item) => item.id === flight.route_id);
  const aircraft = snapshot.aircrafts.find((item) => item.id === flight.aircraft_id);
  const type = snapshot.aircraftTypes.find((item) => item.id === aircraft?.type_id);
  const origin = snapshot.airports.find((item) => item.id === flight.origin_airport_id);
  const destination = snapshot.airports.find((item) => item.id === flight.destination_airport_id);
  const passengers = flight.actual?.passengers ?? flight.expected.passengers;

  return {
    destination_coordinates: destination ? pointFromAirport(destination) : null,
    origin_coordinates: origin ? pointFromAirport(origin) : null,
    telemetry: flightTelemetry(
      {
        arrivalAt: flight.arrival_at,
        cruiseSpeedKph: type?.cruising_speed_kph ?? 740,
        departureAt: flight.departure_at,
        distanceKm: route?.demand_snapshot.distance_km ?? 900,
        fuelBurnKgPerHour: type?.fuel_consumption_per_hour ?? 2000,
        passengers,
      },
      now,
    ),
  };
}
