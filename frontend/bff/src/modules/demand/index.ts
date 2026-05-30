import type { BffConfig } from "../../config";

import { getBackendAdminToken, requireValidUserToken } from "../../auth";
import { jsonResponse } from "../../http";
import { backendRequest, extractBackendId } from "../import/backend/api";
import { clamp, distanceKm, round2 } from "../import/shared/math";

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

function airportMarketFactor(airport: Airport): number {
  const runwayFactor = clamp((airport.max_runway_length_m ?? 1800) / 3500, 0.25, 1.35);
  const slotFactor = clamp(Math.sqrt(airport.max_runway_uses_per_day ?? 90) / Math.sqrt(650), 0.25, 1.35);
  const nightFactor = airport.works_at_night === false ? 0.82 : 1.08;
  const feeTotal = (airport.runway_fee ?? 0) + (airport.gate_fee ?? 0) + (airport.stand_fee ?? 0);
  const feeFactor = clamp(1.16 - feeTotal / 25_000, 0.72, 1.12);
  const fuelFactor = clamp(1.08 - ((airport.fuel_price_multiplier ?? 1) - 1) * 0.18, 0.84, 1.1);
  const codeFactor = airport.iata_code ? 1.08 : 0.86;

  return clamp(runwayFactor * slotFactor * nightFactor * feeFactor * fuelFactor * codeFactor, 0.12, 1.8);
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
  const metrics = calculateDemand(originAirport, destinationAirport, originRegion, destinationRegion, existing);
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

function calculateDemand(
  originAirport: Airport,
  destinationAirport: Airport,
  originRegion: Region,
  destinationRegion: Region,
  existing?: RegionLink,
): {
  business: number;
  destinationToOrigin: number;
  diaspora: number;
  originToDestination: number;
  tourism: number;
} {
  const distance = distanceBetweenAirports(originAirport, destinationAirport);
  const sameCountry = originRegion.country_id && originRegion.country_id === destinationRegion.country_id;
  const business = clamp(existing?.business ?? regionalAffinity(originRegion.business_score, destinationRegion.business_score, distance, sameCountry), 0, 1);
  const tourism = clamp(existing?.tourism ?? regionalAffinity(originRegion.tourism_score, destinationRegion.tourism_score, distance, sameCountry), 0, 1);
  const diaspora = clamp(existing?.diaspora ?? diasporaAffinity(originRegion, destinationRegion, distance, sameCountry), 0, 1);
  const gravity = gravityDemand(originRegion, destinationRegion, distance);
  const airportFactor = Math.sqrt(airportMarketFactor(originAirport) * airportMarketFactor(destinationAirport));
  const affinityFactor = 0.7 + 0.75 * business + 0.55 * tourism + 0.45 * diaspora + (sameCountry ? 0.22 : 0);
  const baseDemand = gravity * airportFactor * affinityFactor;
  const originToDestination = round2(baseDemand * directionFactor(originRegion, destinationRegion, business, tourism, diaspora));
  const destinationToOrigin = round2(baseDemand * directionFactor(destinationRegion, originRegion, business, tourism, diaspora));

  return {
    business: round2(business),
    destinationToOrigin: Math.max(1, destinationToOrigin),
    diaspora: round2(diaspora),
    originToDestination: Math.max(1, originToDestination),
    tourism: round2(tourism),
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

function diasporaAffinity(
  left: Region,
  right: Region,
  distance: number,
  sameCountry: "" | boolean | undefined,
): number {
  const populationBalance = Math.sqrt(
    Math.max(1, Math.min(left.population ?? 1, right.population ?? 1)) /
      Math.max(1, Math.max(left.population ?? 1, right.population ?? 1)),
  );

  return (sameCountry ? 0.42 : 0.06) + 0.22 / (1 + distance / 2200) + 0.32 * populationBalance;
}

function directionFactor(
  origin: Region,
  destination: Region,
  business: number,
  tourism: number,
  diaspora: number,
): number {
  const originWealth = Math.sqrt(Math.max(origin.gdp_per_capita ?? 10_000, 500) / 10_000);
  const destinationLeisure = 0.75 + 0.45 * (destination.tourism_score ?? 0.2);
  const businessPull = 0.82 + 0.28 * business + 0.12 * (destination.business_score ?? 0.2);
  const diasporaPull = 0.92 + 0.16 * diaspora;

  return clamp(originWealth * destinationLeisure * businessPull * diasporaPull, 0.45, 1.8) * (0.88 + 0.24 * tourism);
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

function gravityDemand(left: Region, right: Region, distance: number): number {
  const leftEconomy = Math.max(left.population ?? 100_000, 50_000) * Math.sqrt(Math.max(left.gdp_per_capita ?? 10_000, 500) / 10_000);
  const rightEconomy = Math.max(right.population ?? 100_000, 50_000) * Math.sqrt(Math.max(right.gdp_per_capita ?? 10_000, 500) / 10_000);
  const distancePenalty = 1 / (1 + distance / 1800) ** 1.22;

  return 0.00008 * Math.sqrt(leftEconomy * rightEconomy) * distancePenalty;
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

function regionalAffinity(
  leftScore: number | undefined,
  rightScore: number | undefined,
  distance: number,
  sameCountry: "" | boolean | undefined,
): number {
  const score = Math.sqrt(Math.max(leftScore ?? 0.15, 0.01) * Math.max(rightScore ?? 0.15, 0.01));

  return score * (0.42 + 0.58 / (1 + distance / 5200)) * (sameCountry ? 1.16 : 1);
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
