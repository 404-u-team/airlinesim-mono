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

type RegionLink = {
  base_daily_demand_ab?: number;
  base_daily_demand_ba?: number;
  business?: number;
  diaspora?: number;
  id?: string;
  region_a?: string;
  region_b?: string;
  tourism?: number;
};

export async function loadRoutePlanningSnapshot(
  request: Request,
  config: BffConfig,
): Promise<RoutePlanningSnapshot> {
  const fleetSnapshot = await loadFleetSnapshot(request, config);
  const adminToken = await getBackendAdminToken(config);
  const [regions, regionLinks, hubs] = await Promise.all([
    requestBackendJson<{ regions?: Region[] }>(config, "/regions", { token: adminToken }),
    loadOptionalRegionLinks(config, adminToken),
    listHubsForAirline(fleetSnapshot.airline.id ?? ""),
  ]);

  return {
    ...fleetSnapshot,
    hubAirportIds: hubs.map((hub) => hub.airport_id),
    regionLinks: regionLinks.region_links ?? [],
    regions: regions.regions ?? [],
  };
}

async function loadOptionalRegionLinks(
  config: BffConfig,
  token: string,
): Promise<{ region_links?: RegionLink[] }> {
  try {
    return await requestBackendJson<{ region_links?: RegionLink[] }>(config, "/region-links", { token });
  } catch (error) {
    console.warn("BFF route planning is using an empty region-link fallback:", error);
    return { region_links: [] };
  }
}
