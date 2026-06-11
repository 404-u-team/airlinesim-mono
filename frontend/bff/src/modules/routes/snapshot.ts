import type { BffConfig } from "../../config";
import type { RoutePlanningSnapshot } from "./planning";

import { getBackendAdminToken } from "../../auth";
import { requestBackendJson } from "../../backend-http";
import { loadFleetSnapshot } from "../fleet/snapshot";
import { listHubsForAirline } from "../hubs/storage";

type Region = {
  business_score?: number;
  country_id?: string;
  gdp_per_capita?: number;
  id?: string;
  intl_name?: string;
  local_name?: string;
  population?: number;
  tourism_score?: number;
};

export async function loadRoutePlanningSnapshot(
  request: Request,
  config: BffConfig,
): Promise<RoutePlanningSnapshot> {
  const fleetSnapshot = await loadFleetSnapshot(request, config);
  const adminToken = await getBackendAdminToken(config);
  const [regions, hubs] = await Promise.all([
    requestBackendJson<{ regions?: Region[] }>(config, "/regions", { token: adminToken }),
    listHubsForAirline(fleetSnapshot.airline.id ?? ""),
  ]);

  return {
    ...fleetSnapshot,
    hubAirportIds: hubs.map((hub) => hub.airport_id),
    regions: regions.regions ?? [],
  };
}
