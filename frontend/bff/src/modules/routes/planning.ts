import type { Aircraft, AircraftType, Airport, FleetSnapshot } from "../fleet/types";
import type {
  Region,
  RouteAircraftOption,
  RouteDemandSnapshot,
  RouteEconomics,
  RouteListItem,
  RouteOpportunity,
  RouteReason,
  RouteRecommendation,
  StoredRoute,
} from "./types";

import { resolveAircraftImageUrl } from "../aircraft-images/resolve";
import { computeAirportPairDemand } from "../demand/service";
import { rangeConstraints, runwayConstraints } from "../facilities/constraints";
import { buildRouteEconomics } from "./economics";
import { buildDistanceKm, toRouteAirport } from "./geometry";

export type RoutePlanningSnapshot = FleetSnapshot & {
  hubAirportIds?: string[];
  regions: Region[];
};

export function buildRouteListItem(route: StoredRoute, snapshot: RoutePlanningSnapshot): ReturnType<typeof toRouteListItem> {
  return toRouteListItem(refreshStoredRoute(route, snapshot), snapshot);
}

export function buildRouteOpportunities(
  snapshot: RoutePlanningSnapshot,
  existingRoutes: StoredRoute[],
  originAirportId?: string,
  selectedAircraftId?: string,
): RouteOpportunity[] {
  const origin = findAirport(snapshot.airports, originAirportId ?? snapshot.airline.starting_airport_id);

  if (!origin) {
    return [];
  }

  return snapshot.airports
    .filter((airport) => airport.id && airport.id !== origin.id && airport.region_id)
    .map((airport) => buildRouteOpportunity(snapshot, origin.id, airport.id ?? "", existingRoutes, selectedAircraftId))
    .filter((item): item is RouteOpportunity => item !== null)
    .sort((left, right) => right.score - left.score);
}

export function buildRouteOpportunity(
  snapshot: RoutePlanningSnapshot,
  originAirportId: string | undefined,
  destinationAirportId: string,
  existingRoutes: StoredRoute[],
  selectedAircraftId?: string,
): null | RouteOpportunity {
  const origin = findAirport(snapshot.airports, originAirportId ?? snapshot.airline.starting_airport_id);
  const destination = findAirport(snapshot.airports, destinationAirportId);

  if (!origin || !destination || origin.id === destination.id) {
    return null;
  }

  const demand = buildDemandSnapshot(snapshot, origin, destination);
  const aircraftOptions = buildAircraftOptions(snapshot, origin, destination, selectedAircraftId);
  const selectedOption = aircraftOptions.find((option) => option.aircraft.id === selectedAircraftId) ??
    aircraftOptions.find((option) => option.isCompatible) ??
    aircraftOptions[0] ??
    null;
  const economics = buildRouteEconomics(demand, selectedOption?.type ?? null, origin, destination);
  const existingRoute = existingRoutes.find(
    (route) =>
      route.origin_airport_id === origin.id &&
      route.destination_airport_id === destination.id &&
      route.status !== "paused",
  );
  const warnings = buildRouteWarnings(demand, economics, aircraftOptions);
  const blockers = buildRouteBlockers(snapshot, origin, destination, aircraftOptions, existingRoute);
  const recommendation = getRecommendation(blockers, warnings, economics, demand);

  return {
    compatible_aircraft: aircraftOptions,
    constraints: blockers,
    demand,
    destination_airport: toRouteAirport(destination),
    economics,
    existing_route_id: existingRoute?.id,
    origin_airport: toRouteAirport(origin),
    recommendation,
    score: scoreOpportunity(demand, economics, recommendation),
    warnings,
  };
}

export function createStoredRouteFromOpportunity(
  snapshot: RoutePlanningSnapshot,
  opportunity: RouteOpportunity,
  options: {
    baseFrequencyPerWeek?: number;
    selectedAircraftId?: string;
    selectedAircraftTypeId?: string;
  },
): StoredRoute {
  const selectedAircraft = snapshot.aircrafts.find((aircraft) => aircraft.id === options.selectedAircraftId);
  const now = new Date().toISOString();

  return {
    airline_id: snapshot.airline.id ?? "",
    base_frequency_per_week: options.baseFrequencyPerWeek ?? 3,
    constraints_snapshot: opportunity.constraints,
    created_at: now,
    demand_snapshot: opportunity.demand,
    destination_airport_id: opportunity.destination_airport.id ?? "",
    economics_snapshot: opportunity.economics,
    id: crypto.randomUUID(),
    origin_airport_id: opportunity.origin_airport.id ?? "",
    selected_aircraft_id: selectedAircraft?.id,
    selected_aircraft_type_id: options.selectedAircraftTypeId ?? selectedAircraft?.type_id,
    status: opportunity.recommendation === "blocked" ? "draft" : "awaiting_schedule",
    updated_at: now,
    warnings_snapshot: opportunity.warnings,
  };
}

export function findAirport(airports: Airport[], id: string | undefined): Airport | undefined {
  return airports.find((airport) => airport.id === id);
}

export function isHubOrigin(snapshot: RoutePlanningSnapshot, originId: string | undefined): boolean {
  return Boolean(originId) && (originId === snapshot.airline.starting_airport_id || (snapshot.hubAirportIds ?? []).includes(originId ?? ""));
}

// Recomputes a stored route's demand/economics from current data; the persisted
// snapshot is only a frozen creation-time cache and can hold stale numbers.
export function refreshStoredRoute(route: StoredRoute, snapshot: RoutePlanningSnapshot): StoredRoute {
  const opportunity = buildRouteOpportunity(snapshot, route.origin_airport_id, route.destination_airport_id, [], route.selected_aircraft_id);

  return opportunity ? { ...route, demand_snapshot: opportunity.demand, economics_snapshot: opportunity.economics } : route;
}

function addAircraftStateReasons(
  blockers: RouteReason[],
  warnings: RouteReason[],
  aircraft: Aircraft,
  origin: Airport,
): void {
  if (aircraft.status === "maintenance") {
    addReason(blockers, "AIRCRAFT_NOT_READY", "Aircraft is in maintenance.");
  }
  if (maintenanceRatio(aircraft) < 0.35) {
    addReason(warnings, "AIRCRAFT_MAINTENANCE_LOW", "Aircraft maintenance reserve is low.");
  }
  if (aircraft.base_airport_id && aircraft.base_airport_id !== origin.id) {
    addReason(warnings, "AIRCRAFT_REPOSITION_REQUIRED", "Aircraft is based at another airport.");
  }
}

function addReason(reasons: RouteReason[], code: RouteReason["code"], message: string): void {
  reasons.push({ code, message });
}

function addTypeCompatibilityReasons(
  blockers: RouteReason[],
  type: AircraftType | null,
  origin: Airport,
  destination: Airport,
): void {
  if (!type) {
    addReason(blockers, "MISSING_AIRCRAFT_TYPE", "Aircraft type is missing.");
    return;
  }
  blockers.push(
    ...rangeConstraints(buildDistanceKm(origin, destination), type).map(toRouteReason),
    ...runwayConstraints(origin, type).map(toRouteReason),
    ...runwayConstraints(destination, type).map(toRouteReason),
  );
}

function buildAircraftOption(
  aircraft: Aircraft,
  type: AircraftType | null,
  origin: Airport,
  destination: Airport,
): RouteAircraftOption {
  const blockers: RouteReason[] = [];
  const warnings: RouteReason[] = [];

  addTypeCompatibilityReasons(blockers, type, origin, destination);
  addAircraftStateReasons(blockers, warnings, aircraft, origin);

  return {
    aircraft,
    blockers,
    isCompatible: blockers.length === 0,
    type: type ? { ...type, image_url: resolveAircraftImageUrl(type) } : null,
    warnings,
  };
}

function buildAircraftOptions(
  snapshot: RoutePlanningSnapshot,
  origin: Airport,
  destination: Airport,
  selectedAircraftId?: string,
): RouteAircraftOption[] {
  const typeById = new Map(snapshot.aircraftTypes.map((type) => [type.id, type]));

  const aircrafts = selectedAircraftId
    ? [
      ...snapshot.aircrafts.filter((aircraft) => aircraft.id === selectedAircraftId),
      ...snapshot.aircrafts.filter((aircraft) => aircraft.id !== selectedAircraftId),
    ]
    : snapshot.aircrafts;

  return aircrafts.map((aircraft) => buildAircraftOption(aircraft, typeById.get(aircraft.type_id) ?? null, origin, destination));
}

function buildDemandSnapshot(snapshot: RoutePlanningSnapshot, origin: Airport, destination: Airport): RouteDemandSnapshot {
  const distanceKm = buildDistanceKm(origin, destination);
  const originRegion = snapshot.regions.find((region) => region.id === origin.region_id);
  const destinationRegion = snapshot.regions.find((region) => region.id === destination.region_id);
  const demand = computeAirportPairDemand(origin, destination, originRegion, destinationRegion, distanceKm);

  return {
    breakdown: { ...demand.breakdown, source: demand.breakdown.overrideMultiplier === 1 ? "model" : "override" },
    calculated_at: new Date().toISOString(),
    destination_daily_passengers: demand.destinationDailyPassengers,
    distance_km: Math.round(distanceKm),
    origin_daily_passengers: demand.originDailyPassengers,
  };
}

function buildRouteBlockers(
  snapshot: RoutePlanningSnapshot,
  origin: Airport,
  destination: Airport,
  aircraftOptions: RouteAircraftOption[],
  existingRoute: StoredRoute | undefined,
): RouteReason[] {
  const blockers: RouteReason[] = [];

  if (!isHubOrigin(snapshot, origin.id)) {
    addReason(blockers, "ORIGIN_NOT_HUB", "Origin must be your base or one of your hubs.");
  }
  if (!origin.id || !destination.id) {
    addReason(blockers, "MISSING_AIRPORT", "Airport data is missing.");
  }
  // Intra-metro pairs (e.g. a city's two airports ~40 km apart) are not a flyable
  // market — no one books a 40 km flight. Block them regardless of region.
  if (buildDistanceKm(origin, destination) < 75) {
    addReason(blockers, "ROUTE_DISTANCE_TOO_SHORT", "Airports are too close for a viable route.");
  }
  if (existingRoute) {
    addReason(blockers, "DUPLICATE_ROUTE", "Route already exists.");
  }
  if (aircraftOptions.length > 0 && !aircraftOptions.some((option) => option.isCompatible)) {
    addReason(blockers, "NO_COMPATIBLE_AIRCRAFT", "No owned aircraft can fly this route.");
  }

  return blockers;
}

function buildRouteWarnings(
  demand: RouteDemandSnapshot,
  economics: RouteEconomics,
  aircraftOptions: RouteAircraftOption[],
): RouteReason[] {
  const warnings = aircraftOptions.flatMap((option) => option.warnings);

  if (demand.origin_daily_passengers <= 0) {
    addReason(warnings, "NO_DEMAND_DATA", "Demand data is missing.");
  } else if (demand.origin_daily_passengers < 90) {
    addReason(warnings, "LOW_DEMAND", "Demand is low for a regular route.");
  }
  if (economics.estimated_profit_per_flight <= 0) {
    addReason(warnings, "LOW_PROFIT", "Estimated profit is low.");
  }

  return dedupeReasons(warnings);
}

function dedupeReasons(reasons: RouteReason[]): RouteReason[] {
  const seen = new Set<string>();

  return reasons.filter((reason) => {
    if (seen.has(reason.code)) {
      return false;
    }
    seen.add(reason.code);
    return true;
  });
}

function getRecommendation(
  blockers: RouteReason[],
  warnings: RouteReason[],
  economics: RouteEconomics,
  demand: RouteDemandSnapshot,
): RouteRecommendation {
  if (blockers.length > 0) {
    return "blocked";
  }
  if (warnings.length > 0 || economics.estimated_profit_per_flight <= 0 || demand.origin_daily_passengers < 120) {
    return "risky";
  }
  return "open";
}

function getRouteNextAction(status: StoredRoute["status"]): RouteListItem["next_action"] {
  if (status === "awaiting_schedule") {
    return { code: "CREATE_SCHEDULE", target_path: "/operations/schedule" };
  }
  if (status === "scheduled" || status === "active") {
    return { code: "VIEW_FLIGHTS", target_path: "/operations/live-flights" };
  }

  return { code: "VIEW_ROUTE", target_path: "/airports/routes" };
}

function maintenanceRatio(aircraft: Aircraft): number {
  const max = aircraft.max_maintenance_points_cached ?? 0;

  if (max <= 0) {
    return 1;
  }

  return Math.max(0, Math.min(1, (aircraft.current_maintenance_points ?? max) / max));
}

function recommendationScoreFactor(recommendation: RouteRecommendation): number {
  if (recommendation === "open") {
    return 1.2;
  }
  if (recommendation === "risky") {
    return 0.85;
  }

  return 0.25;
}

function scoreOpportunity(demand: RouteDemandSnapshot, economics: RouteEconomics, recommendation: RouteRecommendation): number {
  return (demand.origin_daily_passengers * 3 + economics.estimated_profit_per_flight / 100) * recommendationScoreFactor(recommendation);
}

function toRouteListItem(route: StoredRoute, snapshot: RoutePlanningSnapshot): RouteListItem {
  const origin = findAirport(snapshot.airports, route.origin_airport_id);
  const destination = findAirport(snapshot.airports, route.destination_airport_id);
  const aircraftOption = route.selected_aircraft_id && origin && destination
    ? buildAircraftOptions(snapshot, origin, destination, route.selected_aircraft_id)
      .find((option) => option.aircraft.id === route.selected_aircraft_id) ?? null
    : null;

  return {
    ...route,
    assigned_aircraft: aircraftOption,
    destination_airport: destination ? toRouteAirport(destination) : null,
    next_action: getRouteNextAction(route.status),
    origin_airport: origin ? toRouteAirport(origin) : null,
  };
}

function toRouteReason(reason: ReturnType<typeof runwayConstraints>[number]): RouteReason {
  return { code: reason.code, message: reason.code };
}
