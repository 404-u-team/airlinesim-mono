/* eslint-disable complexity, max-lines */
import type { BffConfig } from "../../config";

import { getBackendAdminToken, getUserAuthorization, requireValidUserToken } from "../../auth";
import { requestBackendJson } from "../../backend-http";
import { jsonResponse } from "../../http";
import { listFlightsForAirline, listSchedulesForAirline } from "../operations/storage";
import { listRoutesForAirline } from "../routes/storage";

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

type OverlayFlight = {
  arrival_at?: string;
  departure_at?: string;
  expected?: {
    profit?: number;
  };
  id?: string;
  route_id?: string;
  status?: string;
};

type OverlayOperations = {
  flights: OverlayFlight[];
  schedules: Array<{ id?: string; route_id?: string; status?: string }>;
};

type OverlayRoute = {
  demand_snapshot?: {
    origin_daily_passengers?: number;
  };
  destination_airport_id?: string;
  economics_snapshot?: {
    estimated_profit_per_flight?: number;
  };
  id?: string;
  origin_airport_id?: string;
  status?: string;
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
    const [routes, operations] = await Promise.all([
      listRoutesForAirline(snapshot.airline.id ?? ""),
      loadOverlayOperations(snapshot.airline.id ?? ""),
    ]);

    return jsonResponse(buildDashboardSummary(snapshot, routes, operations));
  }

  if (url.pathname === "/game/map-state") {
    const routes = await listRoutesForAirline(snapshot.airline.id ?? "");

    return jsonResponse(buildMapState(snapshot, url.searchParams, routes));
  }

  if (url.pathname === "/game/finance-overview") {
    return jsonResponse(buildFinanceOverview(snapshot));
  }

  if (url.pathname === "/game/facilities-overview") {
    return jsonResponse(buildFacilitiesOverview(snapshot));
  }

  if (url.pathname === "/game/events-feed") {
    const [routes, operations] = await Promise.all([
      listRoutesForAirline(snapshot.airline.id ?? ""),
      loadOverlayOperations(snapshot.airline.id ?? ""),
    ]);

    return jsonResponse(buildEventsFeed(snapshot, routes, operations));
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
  routes: OverlayRoute[],
  operations: OverlayOperations,
): Array<Record<string, unknown>> {
  const alerts: Array<Record<string, unknown>> = [];

  if (!baseAirport) {
    pushDashboardAlert(alerts, "OPEN_ONBOARDING", "MISSING_BASE", "warning", "/onboarding/airline");
  }
  if (fleet.total_aircraft === 0) {
    pushDashboardAlert(alerts, "BUY_FIRST_AIRCRAFT", "NO_AIRCRAFT", "warning", "/fleet/overview");
  }
  if ((snapshot.airline.balance ?? 0) < 5_000_000) {
    pushDashboardAlert(alerts, "OPEN_FINANCES", "LOW_BALANCE", "danger", "/finances/overview");
  }
  if (fleet.average_maintenance_ratio < 0.35 && fleet.total_aircraft > 0) {
    pushDashboardAlert(alerts, "REVIEW_MAINTENANCE", "LOW_MAINTENANCE", "warning", "/fleet/maintenance");
  }
  if (fleet.total_aircraft > 0 && routes.length === 0) {
    pushDashboardAlert(alerts, "PLAN_FIRST_ROUTE", "NO_ROUTES", "info", "/airports/routes");
  }
  if (routes.some((route) => route.status === "awaiting_schedule")) {
    pushDashboardAlert(alerts, "CREATE_SCHEDULE", "ROUTES_AWAITING_SCHEDULE", "info", "/operations/schedule");
  }
  if (operations.flights.some((flight) => flight.status === "boarding" || flight.status === "in_flight")) {
    pushDashboardAlert(alerts, "VIEW_LIVE_FLIGHTS", "LIVE_FLIGHTS", "success", "/operations/live-flights");
  }

  return alerts.slice(0, 5);
}

function buildDashboardSummary(
  snapshot: GameSnapshot,
  routes: OverlayRoute[] = [],
  operations: OverlayOperations = { flights: [], schedules: [] },
): Record<string, unknown> {
  const baseAirport = getBaseAirport(snapshot);
  const fleet = buildFleetSummary(snapshot, baseAirport);
  const alerts = buildDashboardAlerts(snapshot, baseAirport, fleet, routes, operations);
  const hasAircraft = fleet.total_aircraft > 0;
  const liveFlights = operations.flights.filter((flight) => flight.status === "boarding" || flight.status === "in_flight");
  const upcomingFlights = operations.flights.filter((flight) => flight.status === "scheduled");
  const completedFlights = operations.flights.filter((flight) => flight.status === "completed");

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
      capabilities: "configured",
      completed_today: completedFlights.length,
      items: [...liveFlights, ...upcomingFlights].slice(0, 5),
      live_flights: liveFlights.length,
      upcoming_flights: upcomingFlights.length,
    },
    navigation_progress: buildNavigationProgress(hasAircraft, routes, operations),
    next_action: buildNextAction(hasAircraft, routes, operations),
    routes: {
      active_routes: routes.filter((route) => route.status === "active" || route.status === "scheduled").length,
      awaiting_schedule: routes.filter((route) => route.status === "awaiting_schedule").length,
      capabilities: "configured",
      draft_routes: routes.filter((route) => route.status === "draft").length,
      items: routes.slice(0, 5),
    },
    updated_at: new Date().toISOString(),
  };
}

function buildEventsFeed(
  snapshot: GameSnapshot,
  routes: OverlayRoute[] = [],
  operations: OverlayOperations = { flights: [], schedules: [] },
): { events: Array<Record<string, unknown>> } {
  const lowMaintenance = snapshot.aircrafts.filter((aircraft) => maintenanceRatio(aircraft) < 0.35);
  const readyAircraft = snapshot.aircrafts.filter((aircraft) => aircraft.status !== "maintenance");
  const awaitingSchedule = routes.filter((route) => route.status === "awaiting_schedule");
  const liveFlights = operations.flights.filter((flight) => flight.status === "boarding" || flight.status === "in_flight");
  const completedFlights = operations.flights.filter((flight) => flight.status === "completed");
  const events = [
    {
      action: "Review fleet",
      message: `${String(readyAircraft.length)} aircraft available for assignment.`,
      severity: "info",
      title: "Fleet readiness update",
    },
    {
      action: "Plan routes",
      message: routes.length > 0
        ? `${String(routes.length)} routes are saved in your network.`
        : `${String(countCachedDemandLinks(snapshot.regionLinks))} region links have cached passenger demand.`,
      severity: "success",
      title: routes.length > 0 ? "Route network ready" : "Demand cache coverage",
    },
    {
      action: awaitingSchedule.length > 0 ? "Create schedule" : "View flights",
      message: awaitingSchedule.length > 0
        ? `${String(awaitingSchedule.length)} routes are waiting for a schedule.`
        : `${String(liveFlights.length)} live and ${String(completedFlights.length)} completed flights tracked.`,
      severity: awaitingSchedule.length > 0 ? "warning" : "success",
      title: awaitingSchedule.length > 0 ? "Schedule required" : "Operations running",
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

function buildMapState(
  snapshot: GameSnapshot,
  searchParams: URLSearchParams,
  routes: OverlayRoute[] = [],
): Record<string, unknown> {
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
  const routeFeatures = routes
    .map((route) => toRouteFeature(route, snapshot))
    .filter((feature): feature is Record<string, unknown> => feature !== null);

  return {
    airports: {
      features: Array.from(airportFeatures.values()),
      type: "FeatureCollection",
    },
    capabilities: {
      flights: "configured",
      routes: "configured",
    },
    routes: {
      features: routeFeatures,
      type: "FeatureCollection",
    },
    scope: searchParams.get("scope") ?? "dashboard",
    selected: selectedAirport ? toSelectedAirport(selectedAirport, snapshot, baseAirport) : null,
    viewport: buildViewport(Array.from(airportFeatures.values())),
    warnings,
  };
}

function buildNavigationProgress(
  hasAircraft: boolean,
  routes: OverlayRoute[] = [],
  operations: OverlayOperations = { flights: [], schedules: [] },
): Array<Record<string, unknown>> {
  const hasRoutes = routes.length > 0;
  const hasSchedules = operations.schedules.some((schedule) => schedule.status === "active");
  const hasFlights = operations.flights.length > 0;

  return [
    { count: 1, next_path: "/dashboard", path: "/dashboard", reason_code: "DASHBOARD_READY", state: "ready" },
    { count: hasAircraft ? 1 : 0, next_path: "/fleet/overview", path: "/fleet", reason_code: hasAircraft ? "FLEET_READY" : "NO_AIRCRAFT", state: hasAircraft ? "ready" : "empty" },
    buildRoutesProgress(hasAircraft, hasRoutes, routes.length),
    buildOperationsProgress(hasRoutes, hasSchedules, hasFlights, operations),
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

function buildNextAction(
  hasAircraft: boolean,
  routes: OverlayRoute[] = [],
  operations: OverlayOperations = { flights: [], schedules: [] },
): Record<string, unknown> {
  if (!hasAircraft) {
    return {
      code: "BUY_FIRST_AIRCRAFT",
      secondary_target_path: "/finances/overview",
      target_path: "/fleet/overview",
    };
  }
  if (routes.length === 0) {
    return {
      code: "PLAN_FIRST_ROUTE",
      secondary_target_path: "/fleet/aircraft",
      target_path: "/airports/routes",
    };
  }
  if (routes.some((route) => route.status === "awaiting_schedule")) {
    return {
      code: "CREATE_SCHEDULE",
      secondary_target_path: "/airports/routes",
      target_path: "/operations/schedule",
    };
  }
  if (operations.flights.length > 0) {
    return {
      code: "VIEW_LIVE_FLIGHTS",
      secondary_target_path: "/finances/overview",
      target_path: "/operations/live-flights",
    };
  }

  return {
    code: "CHECK_OPERATIONS",
    secondary_target_path: "/airports/routes",
    target_path: "/operations/live-flights",
  };
}

function buildOperationsProgress(
  hasRoutes: boolean,
  hasSchedules: boolean,
  hasFlights: boolean,
  operations: OverlayOperations,
): Record<string, unknown> {
  return {
    count: hasFlights ? operations.flights.length : operations.schedules.length,
    next_path: hasSchedules ? "/operations/live-flights" : "/operations/schedule",
    path: "/operations",
    reason_code: operationsReasonCode(hasRoutes, hasSchedules),
    state: operationsState(hasRoutes, hasSchedules),
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

function buildRoutesProgress(hasAircraft: boolean, hasRoutes: boolean, routeCount: number): Record<string, unknown> {
  return {
    count: routeCount,
    next_path: "/airports/routes",
    path: "/airports",
    reason_code: routesReasonCode(hasAircraft, hasRoutes),
    state: routesState(hasAircraft, hasRoutes),
  };
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
    loadOptionalRegionLinks(config, token),
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

async function loadOptionalRegionLinks(
  config: BffConfig,
  token: string,
): Promise<{ region_links?: RegionLink[] }> {
  try {
    return await requestBackendJson<{ region_links?: RegionLink[] }>(config, "/region-links", { token });
  } catch (error) {
    console.warn("BFF game snapshot is using an empty region-link fallback:", error);
    return { region_links: [] };
  }
}

async function loadOverlayOperations(airlineId: string): Promise<OverlayOperations> {
  const [flights, schedules] = await Promise.all([
    listFlightsForAirline(airlineId),
    listSchedulesForAirline(airlineId),
  ]);

  return { flights, schedules };
}

function maintenanceRatio(aircraft: Aircraft): number {
  const max = aircraft.max_maintenance_points_cached ?? 0;

  if (max <= 0) {
    return 1;
  }

  return Math.max(0, Math.min(1, (aircraft.current_maintenance_points ?? max) / max));
}

function operationsReasonCode(hasRoutes: boolean, hasSchedules: boolean): string {
  if (hasSchedules) {
    return "FLIGHTS_READY";
  }

  return hasRoutes ? "NEEDS_SCHEDULE" : "NEEDS_ROUTE";
}

function operationsState(hasRoutes: boolean, hasSchedules: boolean): string {
  if (hasSchedules) {
    return "ready";
  }

  return hasRoutes ? "empty" : "blocked";
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

function pushDashboardAlert(
  alerts: Array<Record<string, unknown>>,
  actionCode: string,
  code: string,
  severity: string,
  targetPath: string,
): void {
  alerts.push({
    action_code: actionCode,
    code,
    severity,
    target_path: targetPath,
  });
}

function routesReasonCode(hasAircraft: boolean, hasRoutes: boolean): string {
  if (hasRoutes) {
    return "ROUTES_READY";
  }

  return hasAircraft ? "NO_ROUTES" : "NEEDS_AIRCRAFT";
}

function routesState(hasAircraft: boolean, hasRoutes: boolean): string {
  if (hasRoutes) {
    return "ready";
  }

  return hasAircraft ? "empty" : "blocked";
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

function toRouteFeature(route: OverlayRoute, snapshot: GameSnapshot): null | Record<string, unknown> {
  const origin = snapshot.airports.find((airport) => airport.id === route.origin_airport_id);
  const destination = snapshot.airports.find((airport) => airport.id === route.destination_airport_id);
  const originPoint = origin ? pointFromAirport(origin) : null;
  const destinationPoint = destination ? pointFromAirport(destination) : null;

  if (!originPoint || !destinationPoint) {
    return null;
  }

  return {
    geometry: {
      coordinates: [
        [originPoint.longitude, originPoint.latitude],
        [destinationPoint.longitude, destinationPoint.latitude],
      ],
      type: "LineString",
    },
    id: route.id,
    properties: {
      demand: route.demand_snapshot?.origin_daily_passengers ?? 0,
      id: route.id,
      profit: route.economics_snapshot?.estimated_profit_per_flight ?? 0,
      status: route.status ?? "draft",
    },
    type: "Feature",
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
