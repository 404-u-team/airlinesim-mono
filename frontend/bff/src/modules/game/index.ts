/* eslint-disable complexity, max-lines */
import type { BffConfig } from "../../config";

import { getBackendAdminToken, getUserAuthorization, getValidatedUserAirline, requireValidUserToken } from "../../auth";
import { requestBackendJson } from "../../backend-http";
import { parseGeoPoint } from "../../geo";
import { jsonResponse } from "../../http";
import { computeAirportPairDemand } from "../demand/service";
import { reconcileNotificationsForDashboard, reconcileNotificationsForRequest } from "../events/reconcile";
import { listEventsForAirline } from "../events/storage";
import { buildBaseFacilitiesOverview } from "../facilities/overview";
import { loadFacilitiesSnapshot } from "../facilities/snapshot";
import { sumLedger } from "../finance/calculator";
import { listLedgerForAirline } from "../finance/storage";
import { airborneWindow } from "../operations/flight-phases";
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

type DashboardNotification = {
  code: string;
  id: string;
  severity: string;
  state?: string;
  target_path: string;
};

type GameSnapshot = {
  aircrafts: Aircraft[];
  aircraftTypes: AircraftType[];
  airline: Airline;
  airports: Airport[];
  regions: Region[];
};

type OverlayFlight = {
  arrival_at?: string;
  departure_at?: string;
  destination_airport_id?: string;
  expected?: {
    profit?: number;
  };
  flight_number?: string;
  id?: string;
  origin_airport_id?: string;
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
  country_id?: string;
  gdp_per_capita?: number;
  id?: string;
  intl_name?: string;
  local_name?: string;
  population?: number;
  tourism_score?: number;
};

type RouteOpportunity = {
  airport: Airport;
  demand: number;
  region_name: string;
  score: number;
};

export function buildMapState(
  snapshot: GameSnapshot,
  searchParams: URLSearchParams,
  routes: OverlayRoute[] = [],
  operations: OverlayOperations = { flights: [], schedules: [] },
): Record<string, unknown> {
  const baseAirport = getBaseAirport(snapshot);
  const includeOpportunities = searchParams.get("include_opportunities") !== "false";
  const requestedSelectedAirportId = searchParams.get("selected_airport_id");
  const hasNetwork = routes.length > 0 || operations.flights.length > 0;
  const opportunities = includeOpportunities && !hasNetwork
    ? buildRouteOpportunities(snapshot, baseAirport?.id ?? null).slice(0, 12)
    : [];
  const selectedAirport =
    snapshot.airports.find((airport) => airport.id === requestedSelectedAirportId) ??
    opportunities[0]?.airport ??
    baseAirport;
  const routeDestinations = routes
    .map((route) => snapshot.airports.find((airport) => airport.id === route.destination_airport_id))
    .filter((airport): airport is Airport => Boolean(airport));
  const airportFeatures = buildMapAirportFeatures(baseAirport, opportunities, routeDestinations);

  const warnings = [
    ...(baseAirport && !pointFromAirport(baseAirport) ? ["MISSING_BASE_COORDINATES"] : []),
    ...(airportFeatures.size === 0 ? ["NO_MAP_AIRPORTS"] : []),
  ];
  const routeFeatures = routes
    .map((route) => toRouteFeature(route, snapshot))
    .filter((feature): feature is Record<string, unknown> => feature !== null);
  const flightFeatures = operations.flights
    .map((flight) => toFlightFeature(flight, snapshot))
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
    flights: {
      features: flightFeatures,
      type: "FeatureCollection",
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

  const snapshot = await loadGameSnapshot(config, request, userAuthorization);

  if (url.pathname === "/game/dashboard-summary") {
    const [routes, operations] = await Promise.all([
      listRoutesForAirline(snapshot.airline.id ?? ""),
      loadOverlayOperations(snapshot.airline.id ?? ""),
    ]);
    const notifications = await reconcileNotificationsForRequest(request, config).catch(async () =>
      reconcileNotificationsForDashboard({
        aircrafts: snapshot.aircrafts,
        airlineId: snapshot.airline.id ?? "",
        balance: snapshot.airline.balance ?? 0,
        bankrupt: Boolean(snapshot.airline.is_bankrupt),
        routes,
      }));

    return jsonResponse(buildDashboardSummary(snapshot, routes, operations, dashboardAlerts(notifications)));
  }

  if (url.pathname === "/game/map-state") {
    const [routes, operations] = await Promise.all([
      listRoutesForAirline(snapshot.airline.id ?? ""),
      loadOverlayOperations(snapshot.airline.id ?? ""),
    ]);

    return jsonResponse(buildMapState(snapshot, url.searchParams, routes, operations));
  }

  if (url.pathname === "/game/finance-overview") {
    return jsonResponse(buildFinanceOverview(snapshot));
  }

  if (url.pathname === "/game/facilities-overview") {
    return jsonResponse(buildBaseFacilitiesOverview(await loadFacilitiesSnapshot(request, config)));
  }

  if (url.pathname === "/game/events-feed") {
    return jsonResponse({ events: await listEventsForAirline(snapshot.airline.id ?? "") });
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

function buildDashboardSummary(
  snapshot: GameSnapshot,
  routes: OverlayRoute[] = [],
  operations: OverlayOperations = { flights: [], schedules: [] },
  notificationAlerts: Array<Record<string, unknown>> = [],
): Record<string, unknown> {
  const baseAirport = getBaseAirport(snapshot);
  const fleet = buildFleetSummary(snapshot, baseAirport);
  const alerts = notificationAlerts;
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

function buildMapAirportFeatures(
  baseAirport: Airport | undefined,
  opportunities: RouteOpportunity[],
  routeDestinations: Airport[] = [],
): Map<string, Record<string, unknown>> {
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

  // Route destinations take precedence over generic opportunities; never overwrite the base.
  for (const airport of routeDestinations) {
    if (!airport.id || airport.id === baseAirport?.id) {
      continue;
    }
    const feature = toAirportFeature(airport, "route_destination", 0);
    if (feature) {
      airportFeatures.set(airport.id, feature);
    }
  }

  return airportFeatures;
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

function dashboardAlerts(notifications: DashboardNotification[]): Array<Record<string, string>> {
  return notifications
    .filter((item) => item.state === "active")
    .map((item) => ({
      action_code: "OPEN_NOTIFICATION",
      code: item.code,
      id: item.id,
      severity: item.severity,
      target_path: item.target_path,
    }));
}

function getBaseAirport(snapshot: GameSnapshot): Airport | undefined {
  return snapshot.airports.find((airport) => airport.id === snapshot.airline.starting_airport_id);
}

function interpolateFlightPosition(
  origin: { latitude: number; longitude: number },
  destination: { latitude: number; longitude: number },
  flight: OverlayFlight,
): { latitude: number; longitude: number } {
  const departureTime = new Date(flight.departure_at ?? "").getTime();
  const arrivalTime = new Date(flight.arrival_at ?? "").getTime();

  if (!Number.isFinite(departureTime) || !Number.isFinite(arrivalTime) || arrivalTime <= departureTime) {
    return origin;
  }

  const progress = Math.max(0, Math.min(1, (Date.now() - departureTime) / (arrivalTime - departureTime)));

  return {
    latitude: origin.latitude + (destination.latitude - origin.latitude) * progress,
    longitude: origin.longitude + (destination.longitude - origin.longitude) * progress,
  };
}

async function loadGameSnapshot(config: BffConfig, request: Request, userAuthorization: string): Promise<GameSnapshot> {
  const token = await getBackendAdminToken(config);
  const [airline, aircrafts, aircraftTypes, airports, regions] = await Promise.all([
    getValidatedUserAirline<Airline>(request, config),
    requestBackendJson<{ items?: Aircraft[] }>(config, "/aircrafts", { token: userAuthorization }),
    requestBackendJson<{ items?: AircraftType[] }>(config, "/aircraft-types", { token }),
    requestBackendJson<{ airports?: Airport[] }>(config, "/airports", { token }),
    requestBackendJson<{ regions?: Region[] }>(config, "/regions", { token }),
  ]);

  const ledger = await listLedgerForAirline(airline.id ?? "");
  const ledgerDelta = sumLedger(ledger);
  const adjustedAirline = {
    ...airline,
    balance: (airline.balance ?? 0) + ledgerDelta,
  };

  return {
    aircrafts: aircrafts.items ?? [],
    aircraftTypes: aircraftTypes.items ?? [],
    airline: adjustedAirline,
    airports: airports.airports ?? [],
    regions: regions.regions ?? [],
  };
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

function opportunityDistanceKm(origin: Airport, destination: Airport): number {
  const originPoint = pointFromAirport(origin);
  const destinationPoint = pointFromAirport(destination);

  if (!originPoint || !destinationPoint) {
    return 1500;
  }

  const radius = 6371;
  const toRad = (value: number): number => (value * Math.PI) / 180;
  const dLat = toRad(destinationPoint.latitude - originPoint.latitude);
  const dLng = toRad(destinationPoint.longitude - originPoint.longitude);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(originPoint.latitude)) * Math.cos(toRad(destinationPoint.latitude)) * Math.sin(dLng / 2) ** 2;

  return radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function pointFromAirport(airport: Airport): null | { latitude: number; longitude: number } {
  return parseGeoPoint(airport.geog, airport.geom);
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
  role: "base" | "opportunity" | "route_destination",
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

function toFlightFeature(flight: OverlayFlight, snapshot: GameSnapshot): null | Record<string, unknown> {
  if (flight.status === "cancelled" || flight.status === "completed") {
    return null;
  }

  const origin = snapshot.airports.find((airport) => airport.id === flight.origin_airport_id);
  const destination = snapshot.airports.find((airport) => airport.id === flight.destination_airport_id);
  const originPoint = origin ? pointFromAirport(origin) : null;
  const destinationPoint = destination ? pointFromAirport(destination) : null;

  if (!originPoint || !destinationPoint) {
    return null;
  }

  const position = interpolateFlightPosition(originPoint, destinationPoint, flight);
  // Embed the endpoints and the airborne window so the client can interpolate the
  // position locally on a tick — live movement with no extra round-trips or remounts.
  const window = airborneWindow(flight.departure_at ?? "", flight.arrival_at ?? "");

  return {
    geometry: {
      coordinates: [position.longitude, position.latitude],
      type: "Point",
    },
    id: flight.id,
    properties: {
      arrival_at: flight.arrival_at,
      departure_at: flight.departure_at,
      destination: [destinationPoint.longitude, destinationPoint.latitude],
      flight_number: flight.flight_number,
      id: flight.id,
      label: flight.flight_number ?? "Flight",
      landing_at: window?.landing_at,
      origin: [originPoint.longitude, originPoint.latitude],
      profit: flight.expected?.profit ?? 0,
      route_id: flight.route_id,
      status: flight.status ?? "scheduled",
      takeoff_at: window?.takeoff_at,
    },
    type: "Feature",
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
  const originRegion = snapshot.regions.find((item) => item.id === origin.region_id);
  const region = snapshot.regions.find((item) => item.id === destination.region_id);
  const distanceKm = opportunityDistanceKm(origin, destination);
  const demand = computeAirportPairDemand(origin, destination, originRegion, region, distanceKm).originDailyPassengers;
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
