import type { BffConfig } from "../../config";

import { getBackendAdminToken, getUserAuthorization, requireValidUserToken } from "../../auth";
import { jsonResponse } from "../../http";
import { backendRequest } from "../import/backend/api";

type Aircraft = {
  base_airport_id?: string;
  current_maintenance_points?: number;
  id?: string;
  max_maintenance_points_cached?: number;
  status?: string;
  tail_number?: string;
  type_id?: string;
};

type AircraftType = {
  base_maintenance_points?: number;
  cruising_speed_kph?: number;
  fuel_consumption_per_hour?: number;
  id?: string;
  maint_cost_per_flight_hour?: number;
  max_planned_seat_capacity?: number;
  max_range_km?: number;
  min_runway_length_m?: number;
  model_name?: string;
  price_per_unit?: number;
};

type Airline = {
  balance?: number;
  credit_rating?: number;
  id?: string;
  is_bankrupt?: boolean;
  name?: string;
  reputation?: number;
  safety_rating?: number;
  starting_airport_id?: string;
};

type Airport = {
  gate_fee?: number;
  iata_code?: string;
  icao_code?: string;
  id?: string;
  intl_name?: string;
  local_name?: string;
  max_runway_length_m?: number;
  max_runway_uses_per_day?: number;
  region_id?: string;
  stand_fee?: number;
  turnaround_point_price?: number;
  works_at_night?: boolean;
};

type GameSnapshot = {
  aircrafts: Aircraft[];
  aircraftTypes: AircraftType[];
  airline: Airline;
  airports: Airport[];
  regionLinks: RegionLink[];
  regions: Region[];
};

type Region = {
  business_score?: number;
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

type RouteOpportunity = {
  airport: Airport;
  demand: number;
  region_name: string;
  score: number;
};

export async function handleGameRequest(
  request: Request,
  url: URL,
  config: BffConfig,
): Promise<null | Response> {
  if (!url.pathname.startsWith("/game/") || request.method !== "GET") {
    return null;
  }

  const authError = await requireValidUserToken(request, config);
  if (authError) {
    return authError;
  }

  const userAuthorization = getUserAuthorization(request);
  if (!userAuthorization) {
    return jsonResponse({ error: "Missing user token" }, { status: 401 });
  }

  const snapshot = await loadGameSnapshot(config, userAuthorization);

  if (url.pathname === "/game/finance-overview") {
    return jsonResponse(buildFinanceOverview(snapshot));
  }

  if (url.pathname === "/game/facilities-overview") {
    return jsonResponse(buildFacilitiesOverview(snapshot));
  }

  if (url.pathname === "/game/events-feed") {
    return jsonResponse(buildEventsFeed(snapshot));
  }

  if (url.pathname === "/game/network-opportunities") {
    return jsonResponse(buildNetworkOpportunities(snapshot, url.searchParams.get("origin_airport_id")));
  }

  return null;
}

function airportLabel(airport: Airport | undefined): string {
  if (!airport) {
    return "-";
  }

  return `${airport.iata_code ?? airport.icao_code ?? "----"} - ${airport.intl_name ?? airport.local_name ?? "Airport"}`;
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((total, value) => total + value, 0) / values.length;
}

function buildEventsFeed(snapshot: GameSnapshot): { events: Array<Record<string, unknown>> } {
  const lowMaintenance = snapshot.aircrafts.filter((aircraft) => maintenanceRatio(aircraft) < 0.35);
  const readyAircraft = snapshot.aircrafts.filter((aircraft) => aircraft.status !== "maintenance");
  const events = [
    {
      action: "Review fleet",
      message: `${String(readyAircraft.length)} aircraft available for assignment.`,
      severity: "info",
      title: "Fleet readiness update",
    },
    {
      action: "Plan routes",
      message: `${String(countCachedDemandLinks(snapshot.regionLinks))} region links have cached passenger demand.`,
      severity: "success",
      title: "Demand cache coverage",
    },
    {
      action: "Inspect maintenance",
      message: `${String(lowMaintenance.length)} aircraft need maintenance attention.`,
      severity: lowMaintenance.length > 0 ? "warning" : "info",
      title: "Maintenance watch",
    },
    {
      action: "Open finances",
      message: `${snapshot.airline.name ?? "Your airline"} balance is ${formatMoney(snapshot.airline.balance)}.`,
      severity: (snapshot.airline.balance ?? 0) < 5_000_000 ? "danger" : "info",
      title: "Cash position",
    },
  ];

  return { events };
}

function buildFacilitiesOverview(snapshot: GameSnapshot): Record<string, unknown> {
  const baseAirport = snapshot.airports.find((airport) => airport.id === snapshot.airline.starting_airport_id);
  const basedAircraft = snapshot.aircrafts.filter((aircraft) => aircraft.base_airport_id === baseAirport?.id);
  const compatibleTypes = snapshot.aircraftTypes.filter(
    (type) => (type.min_runway_length_m ?? 0) <= (baseAirport?.max_runway_length_m ?? 0),
  );

  return {
    base_airport: baseAirport,
    metrics: {
      based_aircraft: basedAircraft.length,
      compatible_types: compatibleTypes.length,
      daily_slot_capacity: baseAirport?.max_runway_uses_per_day ?? 0,
      night_operations: Boolean(baseAirport?.works_at_night),
    },
    operating_costs: {
      gate_fee: baseAirport?.gate_fee ?? 0,
      stand_fee: baseAirport?.stand_fee ?? 0,
      turnaround_point_price: baseAirport?.turnaround_point_price ?? 0,
    },
    title: airportLabel(baseAirport),
  };
}

function buildFinanceOverview(snapshot: GameSnapshot): Record<string, unknown> {
  const typeById = new Map(snapshot.aircraftTypes.map((type) => [type.id, type]));
  const fleetValue = snapshot.aircrafts.reduce((total, aircraft) => total + (typeById.get(aircraft.type_id)?.price_per_unit ?? 0), 0);
  const dailyMaintenanceReserve = snapshot.aircrafts.reduce(
    (total, aircraft) => total + (typeById.get(aircraft.type_id)?.maint_cost_per_flight_hour ?? 0) * 8,
    0,
  );
  const averageMaintenance = average(snapshot.aircrafts.map(maintenanceRatio));

  return {
    airline: snapshot.airline,
    metrics: {
      average_maintenance_ratio: averageMaintenance,
      balance: snapshot.airline.balance ?? 0,
      credit_rating: snapshot.airline.credit_rating ?? 0,
      daily_maintenance_reserve: dailyMaintenanceReserve,
      fleet_value: fleetValue,
      owned_aircraft: snapshot.aircrafts.length,
    },
  };
}

function buildNetworkOpportunities(
  snapshot: GameSnapshot,
  requestedOriginAirportId: null | string,
): Record<string, unknown> {
  const origin = snapshot.airports.find((airport) => airport.id === (requestedOriginAirportId ?? snapshot.airline.starting_airport_id));

  if (!origin?.region_id) {
    return { airports: compactAirports(snapshot.airports), opportunities: [], origin_airport: null };
  }

  const opportunities = snapshot.airports
    .filter((airport) => airport.id !== origin.id && airport.region_id)
    .map((airport) => toRouteOpportunity(origin, airport, snapshot))
    .filter((opportunity) => opportunity.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, 24);

  return {
    airports: compactAirports(snapshot.airports),
    opportunities,
    origin_airport: origin,
  };
}

function compactAirports(airports: Airport[]): Array<{ id?: string; label: string }> {
  return airports
    .filter((airport) => airport.id)
    .slice(0, 250)
    .map((airport) => ({ id: airport.id, label: airportLabel(airport) }));
}

function countCachedDemandLinks(links: RegionLink[]): number {
  return links.filter((link) => (link.base_daily_demand_ab ?? -1) > 0 && (link.base_daily_demand_ba ?? -1) > 0).length;
}

function demandFromLink(link: RegionLink | undefined, originRegionId: string | undefined): number {
  if (!link) {
    return 0;
  }

  if ((link.base_daily_demand_ab ?? -1) > 0 && (link.base_daily_demand_ba ?? -1) > 0) {
    return link.region_a === originRegionId ? link.base_daily_demand_ab ?? 0 : link.base_daily_demand_ba ?? 0;
  }

  return 80 * ((link.business ?? 0) * 0.42 + (link.tourism ?? 0) * 0.36 + (link.diaspora ?? 0) * 0.22);
}

function findRegionLink(links: RegionLink[], leftRegionId: string | undefined, rightRegionId: string | undefined): RegionLink | undefined {
  return links.find(
    (link) =>
      (link.region_a === leftRegionId && link.region_b === rightRegionId) ||
      (link.region_a === rightRegionId && link.region_b === leftRegionId),
  );
}

function formatMoney(value: number | undefined): string {
  return new Intl.NumberFormat("en", {
    currency: "USD",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(value ?? 0);
}

async function loadGameSnapshot(config: BffConfig, userAuthorization: string): Promise<GameSnapshot> {
  const token = await getBackendAdminToken(config);
  const [airline, aircrafts, aircraftTypes, airports, regions, regionLinks] = await Promise.all([
    requestUserBackend<Airline>(config, "/airline/me", userAuthorization),
    requestUserBackend<{ items?: Aircraft[] }>(config, "/aircrafts", userAuthorization),
    backendRequest<{ items?: AircraftType[] }>(config, "/aircraft-types", { token }),
    backendRequest<{ airports?: Airport[] }>(config, "/airports", { token }),
    backendRequest<{ regions?: Region[] }>(config, "/regions", { token }),
    backendRequest<{ region_links?: RegionLink[] }>(config, "/region-links", { token }),
  ]);

  return {
    aircrafts: aircrafts.items ?? [],
    aircraftTypes: aircraftTypes.items ?? [],
    airline,
    airports: airports.airports ?? [],
    regionLinks: regionLinks.region_links ?? [],
    regions: regions.regions ?? [],
  };
}

function maintenanceRatio(aircraft: Aircraft): number {
  const max = aircraft.max_maintenance_points_cached ?? 0;

  if (max <= 0) {
    return 1;
  }

  return Math.max(0, Math.min(1, (aircraft.current_maintenance_points ?? max) / max));
}

async function requestUserBackend<TValue>(
  config: BffConfig,
  path: string,
  authorization: string,
): Promise<TValue> {
  const response = await fetch(`${config.backendBaseUrl}${path}`, {
    headers: {
      Authorization: authorization,
    },
  });

  if (!response.ok) {
    throw new Error(`Backend ${path} failed with ${String(response.status)}`);
  }

  return (await response.json()) as TValue;
}

function toRouteOpportunity(origin: Airport, destination: Airport, snapshot: GameSnapshot): RouteOpportunity {
  const link = findRegionLink(snapshot.regionLinks, origin.region_id, destination.region_id);
  const region = snapshot.regions.find((item) => item.id === destination.region_id);
  const demand = demandFromLink(link, origin.region_id);
  const slotFactor = Math.sqrt(Math.max(destination.max_runway_uses_per_day ?? 1, 1));
  const score = demand * (0.75 + (region?.business_score ?? 0) * 0.2 + (region?.tourism_score ?? 0) * 0.25) * slotFactor;

  return {
    airport: destination,
    demand,
    region_name: region?.intl_name ?? region?.local_name ?? "-",
    score,
  };
}
