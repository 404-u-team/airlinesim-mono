/* eslint-disable complexity, max-lines */
import type { BffConfig } from "../../config";

import { getBackendAdminToken, getUserAuthorization, requireValidUserToken } from "../../auth";
import { requestBackendJson } from "../../backend-http";
import { jsonResponse } from "../../http";

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
  geog?: string;
  geom?: string;
  iata_code?: string;
  icao_code?: string;
  id?: string;
  intl_name?: string;
  local_name?: string;
  max_runway_length_m?: number;
  max_runway_uses_per_day?: number;
  municipality?: string;
  region_id?: string;
  runway_fee?: number;
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

  if (url.pathname === "/game/dashboard-summary") {
    return jsonResponse(buildDashboardSummary(snapshot));
  }

  if (url.pathname === "/game/map-state") {
    return jsonResponse(buildMapState(snapshot, url.searchParams));
  }

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

function baseWarnings(airport: Airport): string[] {
  const warnings: string[] = [];

  if ((airport.max_runway_length_m ?? 0) < 1800) {
    warnings.push("SHORT_RUNWAY");
  }
  if (!airport.works_at_night) {
    warnings.push("NO_NIGHT_OPS");
  }
  if ((airport.max_runway_uses_per_day ?? 0) < 50) {
    warnings.push("LOW_SLOT_CAPACITY");
  }
  if (!airport.region_id) {
    warnings.push("MISSING_REGION_DATA");
  }

  return warnings;
}

function buildDashboardAlerts(
  snapshot: GameSnapshot,
  baseAirport: Airport | undefined,
  fleet: ReturnType<typeof buildFleetSummary>,
): Array<Record<string, unknown>> {
  const alerts: Array<Record<string, unknown>> = [];

  if (!baseAirport) {
    alerts.push({
      action_code: "OPEN_ONBOARDING",
      code: "MISSING_BASE",
      severity: "warning",
      target_path: "/onboarding/airline",
    });
  }
  if (fleet.total_aircraft === 0) {
    alerts.push({
      action_code: "BUY_FIRST_AIRCRAFT",
      code: "NO_AIRCRAFT",
      severity: "warning",
      target_path: "/fleet/overview",
    });
  }
  if ((snapshot.airline.balance ?? 0) < 5_000_000) {
    alerts.push({
      action_code: "OPEN_FINANCES",
      code: "LOW_BALANCE",
      severity: "danger",
      target_path: "/finances/overview",
    });
  }
  if (fleet.average_maintenance_ratio < 0.35 && fleet.total_aircraft > 0) {
    alerts.push({
      action_code: "REVIEW_MAINTENANCE",
      code: "LOW_MAINTENANCE",
      severity: "warning",
      target_path: "/fleet/maintenance",
    });
  }
  if (fleet.total_aircraft > 0) {
    alerts.push({
      action_code: "PLAN_FIRST_ROUTE",
      code: "NO_ROUTES",
      severity: "info",
      target_path: "/airports/routes",
    });
  }

  return alerts.slice(0, 5);
}

function buildDashboardSummary(snapshot: GameSnapshot): Record<string, unknown> {
  const baseAirport = getBaseAirport(snapshot);
  const fleet = buildFleetSummary(snapshot, baseAirport);
  const alerts = buildDashboardAlerts(snapshot, baseAirport, fleet);
  const hasAircraft = fleet.total_aircraft > 0;
  const routesCapability = "not_configured";
  const flightsCapability = "not_configured";

  return {
    airline: {
      balance: snapshot.airline.balance ?? 0,
      credit_rating: snapshot.airline.credit_rating ?? 0,
      id: snapshot.airline.id,
      is_bankrupt: Boolean(snapshot.airline.is_bankrupt),
      name: snapshot.airline.name ?? "Airline",
      reputation: snapshot.airline.reputation ?? 0,
      safety_rating: snapshot.airline.safety_rating ?? 0,
    },
    alerts,
    base: {
      airport: baseAirport ? toAirportSummary(baseAirport) : null,
      status: baseAirport ? "ready" : "missing",
      warnings: baseAirport ? baseWarnings(baseAirport) : ["MISSING_BASE"],
    },
    fleet,
    flights: {
      capabilities: flightsCapability,
      completed_today: 0,
      items: [],
      live_flights: 0,
      upcoming_flights: 0,
    },
    navigation_progress: buildNavigationProgress(hasAircraft),
    next_action: buildNextAction(hasAircraft),
    routes: {
      active_routes: 0,
      awaiting_schedule: 0,
      capabilities: routesCapability,
      draft_routes: 0,
      items: [],
    },
    updated_at: new Date().toISOString(),
  };
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

function buildFleetSummary(snapshot: GameSnapshot, baseAirport: Airport | undefined): {
  average_maintenance_ratio: number;
  compatible_base_types: number;
  fleet_value: number;
  in_flight_aircraft: number;
  maintenance_aircraft: number;
  ready_aircraft: number;
  total_aircraft: number;
} {
  const typeById = new Map(snapshot.aircraftTypes.map((type) => [type.id, type]));
  const fleetValue = snapshot.aircrafts.reduce((total, aircraft) => total + (typeById.get(aircraft.type_id)?.price_per_unit ?? 0), 0);

  return {
    average_maintenance_ratio: average(snapshot.aircrafts.map(maintenanceRatio)),
    compatible_base_types: snapshot.aircraftTypes.filter(
      (type) => (type.min_runway_length_m ?? 0) <= (baseAirport?.max_runway_length_m ?? 0),
    ).length,
    fleet_value: fleetValue,
    in_flight_aircraft: snapshot.aircrafts.filter((aircraft) => aircraft.status === "in_flight").length,
    maintenance_aircraft: snapshot.aircrafts.filter((aircraft) => aircraft.status === "maintenance").length,
    ready_aircraft: snapshot.aircrafts.filter((aircraft) => aircraft.status !== "maintenance").length,
    total_aircraft: snapshot.aircrafts.length,
  };
}

function buildMapState(snapshot: GameSnapshot, searchParams: URLSearchParams): Record<string, unknown> {
  const baseAirport = getBaseAirport(snapshot);
  const includeOpportunities = searchParams.get("include_opportunities") !== "false";
  const requestedSelectedAirportId = searchParams.get("selected_airport_id");
  const opportunities = includeOpportunities
    ? buildRouteOpportunities(snapshot, baseAirport?.id ?? null).slice(0, 12)
    : [];
  const selectedAirport =
    snapshot.airports.find((airport) => airport.id === requestedSelectedAirportId) ??
    opportunities[0]?.airport ??
    baseAirport;
  const airportFeatures = new Map<string, Record<string, unknown>>();

  if (baseAirport) {
    const feature = toAirportFeature(baseAirport, "base", 0);
    if (feature) {
      airportFeatures.set(baseAirport.id ?? "base", feature);
    }
  }

  for (const opportunity of opportunities) {
    const feature = toAirportFeature(opportunity.airport, "opportunity", opportunity.score, opportunity.demand);
    if (feature) {
      airportFeatures.set(opportunity.airport.id ?? airportLabel(opportunity.airport), feature);
    }
  }

  const warnings = [
    ...(baseAirport && !pointFromAirport(baseAirport) ? ["MISSING_BASE_COORDINATES"] : []),
    ...(airportFeatures.size === 0 ? ["NO_MAP_AIRPORTS"] : []),
  ];

  return {
    airports: {
      features: Array.from(airportFeatures.values()),
      type: "FeatureCollection",
    },
    capabilities: {
      flights: "not_configured",
      routes: "not_configured",
    },
    routes: {
      features: [],
      type: "FeatureCollection",
    },
    scope: searchParams.get("scope") ?? "dashboard",
    selected: selectedAirport ? toSelectedAirport(selectedAirport, snapshot, baseAirport) : null,
    viewport: buildViewport(Array.from(airportFeatures.values())),
    warnings,
  };
}

function buildNavigationProgress(hasAircraft: boolean): Array<Record<string, unknown>> {
  return [
    { count: 1, next_path: "/dashboard", path: "/dashboard", reason_code: "DASHBOARD_READY", state: "ready" },
    { count: hasAircraft ? 1 : 0, next_path: "/fleet/overview", path: "/fleet", reason_code: hasAircraft ? "FLEET_READY" : "NO_AIRCRAFT", state: hasAircraft ? "ready" : "empty" },
    { count: 0, next_path: "/airports/routes", path: "/airports", reason_code: hasAircraft ? "NO_ROUTES" : "NEEDS_AIRCRAFT", state: hasAircraft ? "empty" : "blocked" },
    { count: 0, next_path: "/operations/schedule", path: "/operations", reason_code: "NEEDS_ROUTE", state: "blocked" },
    { count: 1, next_path: "/finances/overview", path: "/finances", reason_code: "FINANCES_READY", state: "ready" },
    { count: 1, next_path: "/staff/overview", path: "/staff", reason_code: "BASE_READY", state: "ready" },
  ];
}

function buildNetworkOpportunities(
  snapshot: GameSnapshot,
  requestedOriginAirportId: null | string,
): Record<string, unknown> {
  const origin = snapshot.airports.find((airport) => airport.id === (requestedOriginAirportId ?? snapshot.airline.starting_airport_id));

  if (!origin?.region_id) {
    return { airports: compactAirports(snapshot.airports), opportunities: [], origin_airport: null };
  }

  const opportunities = buildRouteOpportunities(snapshot, origin.id ?? null).slice(0, 24);

  return {
    airports: compactAirports(snapshot.airports),
    opportunities,
    origin_airport: origin,
  };
}

function buildNextAction(hasAircraft: boolean): Record<string, unknown> {
  if (!hasAircraft) {
    return {
      code: "BUY_FIRST_AIRCRAFT",
      secondary_target_path: "/finances/overview",
      target_path: "/fleet/overview",
    };
  }

  return {
    code: "PLAN_FIRST_ROUTE",
    secondary_target_path: "/fleet/aircraft",
    target_path: "/airports/routes",
  };
}

function buildRouteOpportunities(snapshot: GameSnapshot, requestedOriginAirportId: null | string): RouteOpportunity[] {
  const origin = snapshot.airports.find((airport) => airport.id === (requestedOriginAirportId ?? snapshot.airline.starting_airport_id));

  if (!origin?.region_id) {
    return [];
  }

  return snapshot.airports
    .filter((airport) => airport.id !== origin.id && airport.region_id)
    .map((airport) => toRouteOpportunity(origin, airport, snapshot))
    .filter((opportunity) => opportunity.score > 0)
    .sort((left, right) => right.score - left.score);
}

function buildViewport(features: Array<Record<string, unknown>>): Record<string, unknown> {
  const coordinates = features
    .map((feature) => (feature.geometry as undefined | { coordinates?: unknown })?.coordinates)
    .filter((value): value is [number, number] => Array.isArray(value) && value.length === 2);

  if (coordinates.length === 0) {
    return { center: [0, 0], zoom: 2 };
  }

  if (coordinates.length === 1) {
    return { center: coordinates[0], zoom: 5 };
  }

  const lngs = coordinates.map(([lng]) => lng);
  const lats = coordinates.map(([, lat]) => lat);

  return {
    bounds: [
      [Math.min(...lngs), Math.min(...lats)],
      [Math.max(...lngs), Math.max(...lats)],
    ],
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

function getBaseAirport(snapshot: GameSnapshot): Airport | undefined {
  return snapshot.airports.find((airport) => airport.id === snapshot.airline.starting_airport_id);
}

async function loadGameSnapshot(config: BffConfig, userAuthorization: string): Promise<GameSnapshot> {
  const token = await getBackendAdminToken(config);
  const [airline, aircrafts, aircraftTypes, airports, regions, regionLinks] = await Promise.all([
    requestBackendJson<Airline>(config, "/airline/me", { token: userAuthorization }),
    requestBackendJson<{ items?: Aircraft[] }>(config, "/aircrafts", { token: userAuthorization }),
    requestBackendJson<{ items?: AircraftType[] }>(config, "/aircraft-types", { token }),
    requestBackendJson<{ airports?: Airport[] }>(config, "/airports", { token }),
    requestBackendJson<{ regions?: Region[] }>(config, "/regions", { token }),
    requestBackendJson<{ region_links?: RegionLink[] }>(config, "/region-links", { token }),
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

function pointFromAirport(airport: Airport): null | { latitude: number; longitude: number } {
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

function toAirportFeature(
  airport: Airport,
  role: "base" | "opportunity",
  score: number,
  demand?: number,
): null | Record<string, unknown> {
  const point = pointFromAirport(airport);

  if (!point) {
    return null;
  }

  return {
    geometry: {
      coordinates: [point.longitude, point.latitude],
      type: "Point",
    },
    id: airport.id,
    properties: {
      demand: demand ?? 0,
      iata_code: airport.iata_code,
      icao_code: airport.icao_code,
      id: airport.id,
      label: airportLabel(airport),
      role,
      score,
    },
    type: "Feature",
  };
}

function toAirportSummary(airport: Airport): Record<string, unknown> {
  return {
    coordinates: pointFromAirport(airport),
    gate_fee: airport.gate_fee ?? 0,
    iata_code: airport.iata_code,
    icao_code: airport.icao_code,
    id: airport.id,
    intl_name: airport.intl_name,
    label: airportLabel(airport),
    local_name: airport.local_name,
    max_runway_length_m: airport.max_runway_length_m ?? 0,
    max_runway_uses_per_day: airport.max_runway_uses_per_day ?? 0,
    municipality: airport.municipality,
    runway_fee: airport.runway_fee ?? 0,
    stand_fee: airport.stand_fee ?? 0,
    turnaround_point_price: airport.turnaround_point_price ?? 0,
    works_at_night: Boolean(airport.works_at_night),
  };
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

function toSelectedAirport(
  airport: Airport,
  snapshot: GameSnapshot,
  baseAirport: Airport | undefined,
): Record<string, unknown> {
  const opportunity = baseAirport
    ? toRouteOpportunity(baseAirport, airport, snapshot)
    : undefined;

  return {
    airport: toAirportSummary(airport),
    cta_target_path: airport.id === baseAirport?.id ? "/staff/overview" : "/airports/routes",
    demand: opportunity?.demand ?? 0,
    region_name: opportunity?.region_name ?? "-",
    score: opportunity?.score ?? 0,
  };
}
