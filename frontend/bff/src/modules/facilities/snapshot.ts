import type { BffConfig } from "../../config";
import type { OperationsSnapshot } from "../operations/planning";

import { listFlightsForAirline, listSchedulesForAirline } from "../operations/storage";
import { loadRoutePlanningSnapshot } from "../routes/snapshot";
import { listRoutesForAirline } from "../routes/storage";

export async function loadFacilitiesSnapshot(request: Request, config: BffConfig): Promise<OperationsSnapshot> {
  const routeSnapshot = await loadRoutePlanningSnapshot(request, config);
  const airlineId = routeSnapshot.airline.id ?? "";
  const [flights, routes, schedules] = await Promise.all([
    listFlightsForAirline(airlineId),
    listRoutesForAirline(airlineId),
    listSchedulesForAirline(airlineId),
  ]);

  return {
    ...routeSnapshot,
    flights,
    routes,
    schedules,
  };
}

