import type { BffConfig } from "../../config";
import type { RouteOpportunity, StoredRoute } from "./types";

import { BackendHttpError } from "../../backend-http";
import { jsonResponse, readJson } from "../../http";
import { recordGameEvent } from "../events/producer";
import { reconcileNotificationsAfterMutation } from "../events/reconcile";
import { buildRouteListItem, buildRouteOpportunities, buildRouteOpportunity, createStoredRouteFromOpportunity } from "./planning";
import { loadRoutePlanningSnapshot } from "./snapshot";
import { deleteRoute, findRoute, listRoutesForAirline, saveRoute } from "./storage";

type CreateRouteRequest = {
  base_frequency_per_week?: number;
  destination_airport_id?: string;
  origin_airport_id?: string;
  selected_aircraft_id?: string;
  selected_aircraft_type_id?: string;
};

type PatchRouteRequest = {
  base_frequency_per_week?: number;
  selected_aircraft_id?: string;
  status?: StoredRoute["status"];
};

export async function handleRoutesRequest(
  request: Request,
  url: URL,
  config: BffConfig,
): Promise<null | Response> {
  if (!url.pathname.startsWith("/routes")) {
    return null;
  }

  try {
    return await routeRequest(request, url, config);
  } catch (error) {
    return routeErrorResponse(error);
  }
}

export async function listStoredRoutesForRequest(request: Request, config: BffConfig): Promise<StoredRoute[]> {
  const snapshot = await loadRoutePlanningSnapshot(request, config);

  return listRoutesForAirline(snapshot.airline.id ?? "");
}

async function createRoute(request: Request, config: BffConfig): Promise<Response> {
  const snapshot = await loadRoutePlanningSnapshot(request, config);
  const payload = await readJson<CreateRouteRequest>(request);
  const routes = await listRoutesForAirline(snapshot.airline.id ?? "");
  const opportunity = buildRouteOpportunity(
    snapshot,
    payload.origin_airport_id,
    payload.destination_airport_id ?? "",
    routes,
    payload.selected_aircraft_id,
  );

  if (!opportunity) {
    return jsonResponse({ error: { code: "ROUTE_PREVIEW_FAILED", message: "Could not build route preview." } }, { status: 400 });
  }

  const route = createStoredRouteFromOpportunity(snapshot, opportunity, {
    baseFrequencyPerWeek: payload.base_frequency_per_week,
    selectedAircraftId: payload.selected_aircraft_id,
    selectedAircraftTypeId: payload.selected_aircraft_type_id,
  });
  await saveRoute(route);
  await recordGameEvent({
    airline_id: snapshot.airline.id ?? "",
    category: "route",
    code: "ROUTE_CREATED",
    dedupe_key: `route-created:${route.id}`,
    occurred_at: route.created_at,
    parameters: {
      destination_code: opportunity.destination_airport.iata_code ?? opportunity.destination_airport.icao_code ?? "",
      expected_profit: opportunity.economics.estimated_profit_per_flight,
      origin_code: opportunity.origin_airport.iata_code ?? opportunity.origin_airport.icao_code ?? "",
      recommendation: opportunity.recommendation,
      route_status: route.status,
    },
    related: { route_id: route.id },
    severity: opportunity.recommendation === "blocked" ? "warning" : "success",
    source_id: route.id,
    source_type: "route",
    target_path: "/operations/schedule",
  });
  await reconcileNotificationsAfterMutation(request, config);

  return jsonResponse({
    route: buildRouteListItem(route, snapshot),
  }, { status: 201 });
}

async function deleteRouteRequest(request: Request, config: BffConfig, routeId: string): Promise<Response> {
  const snapshot = await loadRoutePlanningSnapshot(request, config);
  const route = await findRoute(routeId, snapshot.airline.id ?? "");

  if (!route) {
    return jsonResponse({ error: { code: "ROUTE_NOT_FOUND", message: "Route not found." } }, { status: 404 });
  }
  if (route.status === "scheduled" || route.status === "active") {
    return jsonResponse({ error: { code: "ROUTE_HAS_DEPENDENCIES", message: "Scheduled routes cannot be deleted." } }, { status: 409 });
  }

  await deleteRoute(routeId, snapshot.airline.id ?? "");

  return jsonResponse({ route });
}

function filterOpportunity(opportunity: RouteOpportunity, searchParams: URLSearchParams): boolean {
  return [
    matchesDemandFilter(opportunity, searchParams),
    matchesDistanceFilter(opportunity, searchParams),
    matchesCompatibleFilter(opportunity, searchParams),
    matchesProfitFilter(opportunity, searchParams),
  ].every(Boolean);
}

async function listRouteOpportunities(request: Request, url: URL, config: BffConfig): Promise<Response> {
  const snapshot = await loadRoutePlanningSnapshot(request, config);
  const routes = await listRoutesForAirline(snapshot.airline.id ?? "");
  const limit = Number(url.searchParams.get("limit") ?? "24");
  const opportunities = buildRouteOpportunities(
    snapshot,
    routes,
    url.searchParams.get("origin_airport_id") ?? undefined,
    url.searchParams.get("aircraft_id") ?? undefined,
  )
    .filter((opportunity) => filterOpportunity(opportunity, url.searchParams))
    .slice(0, Number.isFinite(limit) ? Math.max(1, Math.min(limit, 100)) : 24);

  return jsonResponse({
    opportunities,
    origin_airport: opportunities[0]?.origin_airport ?? null,
    routes: routes.map((route) => buildRouteListItem(route, snapshot)),
  });
}

async function listRoutes(request: Request, config: BffConfig): Promise<Response> {
  const snapshot = await loadRoutePlanningSnapshot(request, config);
  const routes = await listRoutesForAirline(snapshot.airline.id ?? "");

  return jsonResponse({
    routes: routes.map((route) => buildRouteListItem(route, snapshot)),
  });
}

function matchesCompatibleFilter(opportunity: RouteOpportunity, searchParams: URLSearchParams): boolean {
  return searchParams.get("only_compatible") !== "true" ||
    opportunity.compatible_aircraft.some((option) => option.isCompatible);
}

function matchesDemandFilter(opportunity: RouteOpportunity, searchParams: URLSearchParams): boolean {
  const minDemand = Number(searchParams.get("min_demand") ?? "0");

  return !Number.isFinite(minDemand) || minDemand <= 0 || opportunity.demand.origin_daily_passengers >= minDemand;
}

function matchesDistanceFilter(opportunity: RouteOpportunity, searchParams: URLSearchParams): boolean {
  const maxDistance = Number(searchParams.get("max_distance") ?? "0");

  return !Number.isFinite(maxDistance) || maxDistance <= 0 || opportunity.demand.distance_km <= maxDistance;
}

function matchesProfitFilter(opportunity: RouteOpportunity, searchParams: URLSearchParams): boolean {
  return searchParams.get("only_profitable") !== "true" ||
    opportunity.economics.estimated_profit_per_flight > 0;
}

async function patchRoute(request: Request, config: BffConfig, routeId: string): Promise<Response> {
  const snapshot = await loadRoutePlanningSnapshot(request, config);
  const route = await findRoute(routeId, snapshot.airline.id ?? "");

  if (!route) {
    return jsonResponse({ error: { code: "ROUTE_NOT_FOUND", message: "Route not found." } }, { status: 404 });
  }

  const payload = await readJson<PatchRouteRequest>(request);
  const updatedRoute = {
    ...route,
    base_frequency_per_week: payload.base_frequency_per_week ?? route.base_frequency_per_week,
    selected_aircraft_id: payload.selected_aircraft_id ?? route.selected_aircraft_id,
    status: payload.status ?? route.status,
    updated_at: new Date().toISOString(),
  };

  await saveRoute(updatedRoute);

  return jsonResponse({ route: buildRouteListItem(updatedRoute, snapshot) });
}

async function previewRoute(request: Request, url: URL, config: BffConfig, destinationAirportId: string): Promise<Response> {
  const snapshot = await loadRoutePlanningSnapshot(request, config);
  const routes = await listRoutesForAirline(snapshot.airline.id ?? "");
  const opportunity = buildRouteOpportunity(
    snapshot,
    url.searchParams.get("origin_airport_id") ?? undefined,
    destinationAirportId,
    routes,
    url.searchParams.get("aircraft_id") ?? undefined,
  );

  if (!opportunity) {
    return jsonResponse({ error: { code: "ROUTE_PREVIEW_FAILED", message: "Could not build route preview." } }, { status: 404 });
  }

  return jsonResponse({ preview: opportunity });
}

async function readRoute(request: Request, config: BffConfig, routeId: string): Promise<Response> {
  const snapshot = await loadRoutePlanningSnapshot(request, config);
  const route = await findRoute(routeId, snapshot.airline.id ?? "");

  if (!route) {
    return jsonResponse({ error: { code: "ROUTE_NOT_FOUND", message: "Route not found." } }, { status: 404 });
  }

  return jsonResponse({ route: buildRouteListItem(route, snapshot) });
}

async function routeCollectionRequest(request: Request, url: URL, config: BffConfig): Promise<Response> {
  if (request.method === "GET" && url.pathname === "/routes/opportunities") {
    return listRouteOpportunities(request, url, config);
  }
  if (request.method === "GET" && url.pathname === "/routes") {
    return listRoutes(request, config);
  }
  if (request.method === "POST" && url.pathname === "/routes") {
    return createRoute(request, config);
  }

  return jsonResponse({ error: { code: "ROUTE_NOT_FOUND", message: "Route endpoint not found." } }, { status: 404 });
}

async function routeDetailRequest(request: Request, config: BffConfig, routeId: string): Promise<Response> {
  if (request.method === "GET") {
    return readRoute(request, config, routeId);
  }
  if (request.method === "PATCH") {
    return patchRoute(request, config, routeId);
  }
  if (request.method === "DELETE") {
    return deleteRouteRequest(request, config, routeId);
  }

  return jsonResponse({ error: { code: "METHOD_NOT_ALLOWED", message: "Method not allowed." } }, { status: 405 });
}

function routeErrorResponse(error: unknown): Response {
  if (error instanceof BackendHttpError) {
    return jsonResponse(error.toNormalizedJson(), { status: error.status });
  }
  const message = error instanceof Error ? error.message : "Route request failed.";

  return jsonResponse({ error: { code: "ROUTE_ERROR", message } }, { status: 500 });
}

async function routeOpportunityPreviewRequest(
  request: Request,
  url: URL,
  config: BffConfig,
  destinationAirportId: string,
): Promise<Response> {
  if (request.method === "GET") {
    return previewRoute(request, url, config, destinationAirportId);
  }

  return jsonResponse({ error: { code: "METHOD_NOT_ALLOWED", message: "Method not allowed." } }, { status: 405 });
}

async function routeRequest(request: Request, url: URL, config: BffConfig): Promise<Response> {
  const previewMatch = /^\/routes\/opportunities\/([^/]+)\/preview$/.exec(url.pathname);
  if (previewMatch?.[1]) {
    return routeOpportunityPreviewRequest(request, url, config, decodeURIComponent(previewMatch[1]));
  }

  const routeMatch = /^\/routes\/([^/]+)$/.exec(url.pathname);
  if (routeMatch?.[1]) {
    return routeDetailRequest(request, config, decodeURIComponent(routeMatch[1]));
  }

  return routeCollectionRequest(request, url, config);
}
