import type { BffConfig } from "../../config";
import type { OperationsSnapshot } from "./planning";
import type { StoredFlight } from "./types";

import { refreshStoredRoute } from "../routes/planning";
import { loadRoutePlanningSnapshot } from "../routes/snapshot";
import { listRoutesForAirline } from "../routes/storage";
import { recomputeFlightExpected } from "./flights";
import { listFlightsForAirline, listSchedulesForAirline } from "./storage";

// Drops generated flights whose (route, aircraft, departure) key already exists, so
// re-saving an unchanged schedule does not create duplicate flight rows.
export function dedupeGeneratedFlights(currentFlights: StoredFlight[], generatedFlights: StoredFlight[]): StoredFlight[] {
  const existingKeys = new Set(currentFlights.map((flight) => `${flight.route_id}:${flight.aircraft_id}:${flight.departure_at}`));

  return generatedFlights.filter((flight) => {
    const key = `${flight.route_id}:${flight.aircraft_id}:${flight.departure_at}`;
    if (existingKeys.has(key)) {
      return false;
    }
    existingKeys.add(key);
    return true;
  });
}

export async function loadOperationsSnapshot(request: Request, config: BffConfig): Promise<OperationsSnapshot> {
  const routeSnapshot = await loadRoutePlanningSnapshot(request, config);
  const airlineId = routeSnapshot.airline.id ?? "";
  const [routes, schedules, flights] = await Promise.all([
    listRoutesForAirline(airlineId),
    listSchedulesForAirline(airlineId),
    listFlightsForAirline(airlineId),
  ]);

  const snapshot: OperationsSnapshot = {
    ...routeSnapshot,
    flights,
    routes: routes.map((route) => refreshStoredRoute(route, routeSnapshot)),
    schedules,
  };

  return { ...snapshot, flights: flights.map((flight) => recomputeFlightExpected(flight, snapshot)) };
}
