import type { BffConfig } from "../../config";

import { getBackendAdminToken, requireValidUserToken } from "../../auth";
import { jsonResponse } from "../../http";
import { backendRequest, extractBackendId } from "../import/backend/api";
import { distanceKm } from "../import/shared/math";
import { calculatePassengerDemand } from "./model";

type Airport = {
  fuel_price_multiplier?: number;
  gate_fee?: number;
  geog?: string;
  geom?: string;
  iata_code?: string;
  icao_code?: string;
  id?: string;
  intl_name?: string;
  local_name?: string;
  max_runway_length_m?: number;
  max_runway_uses_per_day?: number;
  region_id?: string;
  runway_fee?: number;
  stand_fee?: number;
  works_at_night?: boolean;
};

type DemandSnapshot = {
  airports: Airport[];
  regionLinks: RegionLink[];
  regions: Region[];
};

type Point = {
  latitude: number;
  longitude: number;
};

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

export async function handleDemandRequest(
  request: Request,
  url: URL,
  config: BffConfig,
): Promise<null | Response> {
  if (request.method !== "GET" || url.pathname !== "/demand/airport-pair") {
    return null;
  }

  const authError = await requireValidUserToken(request, config);
  if (authError) {
    return authError;
  }

  const airportPair = parseAirportPair(url);

  if (!airportPair) {
    return jsonResponse(
      { error: "origin_airport_id and destination_airport_id are required and must be different" },
      { status: 400 },
    );
  }

  const token = await getBackendAdminToken(config);
  const snapshot = await loadDemandSnapshot(config, token);
  const originAirport = snapshot.airports.find((airport) => airport.id === airportPair.originAirportId);
  const destinationAirport = snapshot.airports.find((airport) => airport.id === airportPair.destinationAirportId);

  if (!originAirport || !destinationAirport) {
    return jsonResponse({ error: "Airport not found" }, { status: 404 });
  }

  const originRegion = snapshot.regions.find((region) => region.id === originAirport.region_id);
  const destinationRegion = snapshot.regions.find((region) => region.id === destinationAirport.region_id);

  if (!originRegion?.id || !destinationRegion?.id || originRegion.id === destinationRegion.id) {
    return jsonResponse({ error: "Airport regions are missing or equal" }, { status: 400 });
  }

  const regionLink = await ensureRegionLink(
    config,
    token,
    snapshot,
    originAirport,
    destinationAirport,
    originRegion,
    destinationRegion,
  );
  const orderedDemand = demandForRequestDirection(regionLink, originRegion.id, destinationRegion.id);

  return jsonResponse({
    demand: {
      cached: orderedDemand.cached,
      destination_airport_id: destinationAirport.id,
      destination_daily_passengers: orderedDemand.destinationDailyPassengers,
      distance_km: Math.round(distanceBetweenAirports(originAirport, destinationAirport)),
      origin_airport_id: originAirport.id,
      origin_daily_passengers: orderedDemand.originDailyPassengers,
      region_link_id: regionLink.id,
    },
  });
}

function buildRegionLinkPayload(
  originAirport: Airport,
  destinationAirport: Airport,
  originRegion: Region,
  destinationRegion: Region,
  existing?: RegionLink,
): {
  base_daily_demand_ab: number;
  base_daily_demand_ba: number;
  business: number;
  diaspora: number;
  region_a: string;
  region_b: string;
  tourism: number;
} {
  const metrics = calculatePassengerDemand(
    originAirport,
    destinationAirport,
    originRegion,
    destinationRegion,
    distanceBetweenAirports(originAirport, destinationAirport),
    existing,
  );
  const sortedRegionIds = [originRegion.id ?? "", destinationRegion.id ?? ""].sort();
  const regionA = sortedRegionIds[0] ?? "";
  const regionB = sortedRegionIds[1] ?? "";

  return {
    base_daily_demand_ab: originRegion.id === regionA ? metrics.originToDestination : metrics.destinationToOrigin,
    base_daily_demand_ba: originRegion.id === regionA ? metrics.destinationToOrigin : metrics.originToDestination,
    business: metrics.business,
    diaspora: metrics.diaspora,
    region_a: regionA,
    region_b: regionB,
    tourism: metrics.tourism,
  };
}

async function createRegionLinkDemand(
  config: BffConfig,
  token: string,
  payload: ReturnType<typeof buildRegionLinkPayload>,
): Promise<RegionLink> {
  const response = await backendRequest(config, "/region-link", {
    body: payload,
    method: "POST",
    token,
  });
  const id = extractBackendId(response);

  return { ...payload, id: id ?? undefined };
}

function demandForRequestDirection(
  link: RegionLink,
  originRegionId: string,
  destinationRegionId: string,
): {
  cached: boolean;
  destinationDailyPassengers: number;
  originDailyPassengers: number;
} {
  const cached = hasCachedDemand(link);
  const ab = Math.max(0, link.base_daily_demand_ab ?? 0);
  const ba = Math.max(0, link.base_daily_demand_ba ?? 0);
  const originDailyPassengers = link.region_a === originRegionId && link.region_b === destinationRegionId ? ab : ba;
  const destinationDailyPassengers = link.region_a === originRegionId && link.region_b === destinationRegionId ? ba : ab;

  return { cached, destinationDailyPassengers, originDailyPassengers };
}

function distanceBetweenAirports(left: Airport, right: Airport): number {
  const leftPoint = pointFromAirport(left);
  const rightPoint = pointFromAirport(right);

  if (!leftPoint || !rightPoint) {
    return 1500;
  }

  return Math.max(50, distanceKm(leftPoint.latitude, leftPoint.longitude, rightPoint.latitude, rightPoint.longitude));
}

async function ensureRegionLink(
  config: BffConfig,
  token: string,
  snapshot: DemandSnapshot,
  originAirport: Airport,
  destinationAirport: Airport,
  originRegion: Region,
  destinationRegion: Region,
): Promise<RegionLink> {
  const existing = findRegionLink(snapshot.regionLinks, originRegion.id ?? "", destinationRegion.id ?? "");

  if (existing?.id && hasCachedDemand(existing)) {
    return existing;
  }

  const payload = buildRegionLinkPayload(
    originAirport,
    destinationAirport,
    originRegion,
    destinationRegion,
    existing,
  );

  if (existing?.id) {
    return updateRegionLinkDemand(config, token, existing, payload);
  }

  return createRegionLinkDemand(config, token, payload);
}

function findRegionLink(links: RegionLink[], regionA: string, regionB: string): RegionLink | undefined {
  return links.find(
    (link) =>
      (link.region_a === regionA && link.region_b === regionB) ||
      (link.region_a === regionB && link.region_b === regionA),
  );
}

function hasCachedDemand(link: RegionLink): boolean {
  return (link.base_daily_demand_ab ?? -1) > 0 && (link.base_daily_demand_ba ?? -1) > 0;
}

async function loadDemandSnapshot(config: BffConfig, token: string): Promise<DemandSnapshot> {
  const [airports, regions, regionLinks] = await Promise.all([
    backendRequest<{ airports?: Airport[] }>(config, "/airports", { token }),
    backendRequest<{ regions?: Region[] }>(config, "/regions", { token }),
    backendRequest<{ region_links?: RegionLink[] }>(config, "/region-links", { token }),
  ]);

  return {
    airports: airports.airports ?? [],
    regionLinks: regionLinks.region_links ?? [],
    regions: regions.regions ?? [],
  };
}

function parseAirportPair(url: URL): null | {
  destinationAirportId: string;
  originAirportId: string;
} {
  const originAirportId = url.searchParams.get("origin_airport_id")?.trim();
  const destinationAirportId = url.searchParams.get("destination_airport_id")?.trim();

  if (!originAirportId || !destinationAirportId || originAirportId === destinationAirportId) {
    return null;
  }

  return { destinationAirportId, originAirportId };
}

function pointFromAirport(airport: Airport): null | Point {
  const match = /POINT\s*\(\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s*\)/i.exec(
    airport.geog ?? airport.geom ?? "",
  );

  if (!match?.[1] || !match[2]) {
    return null;
  }

  return {
    latitude: Number(match[2]),
    longitude: Number(match[1]),
  };
}

async function updateRegionLinkDemand(
  config: BffConfig,
  token: string,
  existing: RegionLink,
  payload: ReturnType<typeof buildRegionLinkPayload>,
): Promise<RegionLink> {
  await backendRequest(config, `/region-link/${existing.id ?? ""}`, {
    body: { ...payload, id: existing.id },
    method: "PUT",
    token,
  });

  return { ...existing, ...payload };
}
