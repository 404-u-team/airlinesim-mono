import type { BffConfig } from "../../config";

import { getBackendAdminToken, requireValidUserToken } from "../../auth";
import { parseGeoPoint } from "../../geo";
import { jsonResponse } from "../../http";
import { backendRequest } from "../import/backend/api";
import { distanceKm } from "../import/shared/math";
import { computeAirportPairDemand } from "./service";

type Airport = {
  geog?: string;
  geom?: string;
  iata_code?: string;
  icao_code?: string;
  id?: string;
  region_id?: string;
};

type DemandSnapshot = {
  airports: Airport[];
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
  population?: number;
  tourism_score?: number;
};

// GET /demand/airport-pair — live, local passenger-demand for an airport pair.
// Computed by the layered model + data layers (catchment, propensity, overrides);
// no backend RegionLink is read or written. See docs/passenger-demand-model.md.
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
  const distance = distanceBetweenAirports(originAirport, destinationAirport);
  const demand = computeAirportPairDemand(originAirport, destinationAirport, originRegion, destinationRegion, distance);

  return jsonResponse({
    demand: {
      breakdown: demand.breakdown,
      destination_airport_id: destinationAirport.id,
      destination_daily_passengers: demand.destinationDailyPassengers,
      distance_km: Math.round(distance),
      origin_airport_id: originAirport.id,
      origin_daily_passengers: demand.originDailyPassengers,
    },
  });
}

function distanceBetweenAirports(left: Airport, right: Airport): number {
  const leftPoint = pointFromAirport(left);
  const rightPoint = pointFromAirport(right);

  if (!leftPoint || !rightPoint) {
    return 1500;
  }

  return Math.max(50, distanceKm(leftPoint.latitude, leftPoint.longitude, rightPoint.latitude, rightPoint.longitude));
}

async function loadDemandSnapshot(config: BffConfig, token: string): Promise<DemandSnapshot> {
  const [airports, regions] = await Promise.all([
    backendRequest<{ airports?: Airport[] }>(config, "/airports", { token }),
    backendRequest<{ regions?: Region[] }>(config, "/regions", { token }),
  ]);

  return {
    airports: airports.airports ?? [],
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
  return parseGeoPoint(airport.geog, airport.geom);
}
