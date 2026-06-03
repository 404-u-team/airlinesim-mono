import type { Aircraft, AircraftType, Airport, FleetSnapshot } from "../fleet/types";
import type {
  RouteAircraftOption,
  RouteDemandSnapshot,
  RouteEconomics,
  RouteListItem,
  RouteOpportunity,
  RouteReason,
  RouteRecommendation,
  StoredRoute,
} from "./types";

import { buildRouteEconomics } from "./economics";
import { buildDistanceKm, toRouteAirport } from "./geometry";

export type RoutePlanningSnapshot = FleetSnapshot & {
  regionLinks: RegionLink[];
  regions: Region[];
};

type Region = {
  business_score?: number;
  id?: string;
  intl_name?: string;
  local_name?: string;
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

export function buildRouteListItem(route: StoredRoute, snapshot: RoutePlanningSnapshot): ReturnType<typeof toRouteListItem> {
  return toRouteListItem(route, snapshot);
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
  if ((type.max_range_km ?? 0) < buildDistanceKm(origin, destination)) {
    addReason(blockers, "DISTANCE_EXCEEDS_RANGE", "Aircraft range is below route distance.");
  }
  if ((origin.max_runway_length_m ?? 0) < (type.min_runway_length_m ?? 0)) {
    addReason(blockers, "ORIGIN_RUNWAY_TOO_SHORT", "Origin runway is too short.");
  }
  if ((destination.max_runway_length_m ?? 0) < (type.min_runway_length_m ?? 0)) {
    addReason(blockers, "DESTINATION_RUNWAY_TOO_SHORT", "Destination runway is too short.");
  }
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
    type,
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
  const link = findRegionLink(snapshot.regionLinks, origin.region_id, destination.region_id);
  const cachedDemand = demandFromLink(link, origin.region_id);
  const fallbackDemand = fallbackDemandForAirports(snapshot, origin, destination);
  const originDailyPassengers = Math.max(0, Math.round(cachedDemand > 0 ? cachedDemand : fallbackDemand));

  return {
    calculated_at: new Date().toISOString(),
    destination_daily_passengers: Math.max(0, Math.round(originDailyPassengers * 0.92)),
    distance_km: Math.round(buildDistanceKm(origin, destination)),
    origin_daily_passengers: originDailyPassengers,
    region_link_id: link?.id,
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

  if (origin.id !== snapshot.airline.starting_airport_id) {
    addReason(blockers, "ORIGIN_NOT_BASE", "Origin is not your current base.");
  }
  if (!origin.id || !destination.id) {
    addReason(blockers, "MISSING_AIRPORT", "Airport data is missing.");
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

function demandFromLink(link: RegionLink | undefined, originRegionId: string | undefined): number {
  if (!link) {
    return 0;
  }
  if ((link.base_daily_demand_ab ?? -1) > 0 && (link.base_daily_demand_ba ?? -1) > 0) {
    return link.region_a === originRegionId ? link.base_daily_demand_ab ?? 0 : link.base_daily_demand_ba ?? 0;
  }
  return 80 * ((link.business ?? 0) * 0.42 + (link.tourism ?? 0) * 0.36 + (link.diaspora ?? 0) * 0.22);
}

function fallbackDemandForAirports(snapshot: RoutePlanningSnapshot, origin: Airport, destination: Airport): number {
  const originRegion = snapshot.regions.find((region) => region.id === origin.region_id);
  const destinationRegion = snapshot.regions.find((region) => region.id === destination.region_id);
  const distance = buildDistanceKm(origin, destination);
  const score = Math.sqrt((originRegion?.business_score ?? 0.2) * (destinationRegion?.tourism_score ?? 0.2));

  return Math.max(40, Math.round(260 * score * (1 / (1 + distance / 5500))));
}

function findRegionLink(links: RegionLink[], leftRegionId: string | undefined, rightRegionId: string | undefined): RegionLink | undefined {
  return links.find(
    (link) =>
      (link.region_a === leftRegionId && link.region_b === rightRegionId) ||
      (link.region_a === rightRegionId && link.region_b === leftRegionId),
  );
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
