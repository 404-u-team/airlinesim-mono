import type { BffConfig } from "../../config";
import type { StoredFlight, StoredSchedule } from "./types";

import { BackendHttpError } from "../../backend-http";
import { jsonResponse, readJson } from "../../http";
import { buildRouteListItem } from "../routes/planning";
import { loadRoutePlanningSnapshot } from "../routes/snapshot";
import { listRoutesForAirline, saveRoute } from "../routes/storage";
import { updateFlightStatuses } from "./flights";
import { buildSchedulePreview, createScheduleFromPreview, type OperationsSnapshot } from "./planning";
import { listFlightsForAirline, listSchedulesForAirline, saveFlights, saveSchedule } from "./storage";

type ScheduleRequest = {
  aircraft_id?: string;
  days_of_week?: number[];
  departure_local_time?: string;
  route_id?: string;
  starts_on?: string;
  turnaround_minutes?: number;
};

export async function getOperationsStateForRequest(request: Request, config: BffConfig): Promise<{
  flights: StoredFlight[];
  schedules: StoredSchedule[];
}> {
  const snapshot = await loadOperationsSnapshot(request, config);
  const flights = updateFlightStatuses(snapshot.flights);

  return {
    flights,
    schedules: snapshot.schedules,
  };
}

export async function handleOperationsRequest(
  request: Request,
  url: URL,
  config: BffConfig,
): Promise<null | Response> {
  if (!url.pathname.startsWith("/operations/")) {
    return null;
  }

  try {
    return await operationRequest(request, url, config);
  } catch (error) {
    return operationErrorResponse(error);
  }
}

async function activateSchedule(request: Request, config: BffConfig): Promise<Response> {
  const snapshot = await loadOperationsSnapshot(request, config);
  const payload = await readJson<ScheduleRequest>(request);
  const preview = buildSchedulePreview(snapshot, payload);
  const { flights, schedule } = createScheduleFromPreview(snapshot, payload, preview);

  await saveSchedule(schedule);
  await saveFlights(dedupeGeneratedFlights(snapshot.flights, flights));

  const route = snapshot.routes.find((item) => item.id === schedule.route_id);
  if (route && schedule.status === "active") {
    await saveRoute({
      ...route,
      status: "scheduled",
      updated_at: new Date().toISOString(),
    });
  }

  return jsonResponse({ flights, preview, schedule }, { status: 201 });
}

async function completeFlight(request: Request, config: BffConfig, flightId: string): Promise<Response> {
  const snapshot = await loadOperationsSnapshot(request, config);
  const flight = snapshot.flights.find((item) => item.id === flightId);

  if (!flight) {
    return jsonResponse({ error: { code: "FLIGHT_NOT_FOUND", message: "Flight not found." } }, { status: 404 });
  }

  const completedFlight = {
    ...flight,
    actual: flight.actual ?? flight.expected,
    status: "completed" as const,
    updated_at: new Date().toISOString(),
  };
  await saveFlights([completedFlight]);

  return jsonResponse({ flight: completedFlight });
}

function dedupeGeneratedFlights(currentFlights: StoredFlight[], generatedFlights: StoredFlight[]): StoredFlight[] {
  const existingKeys = new Set(currentFlights.map((flight) => `${flight.route_id}:${flight.aircraft_id}:${flight.departure_at}`));

  return generatedFlights.filter((flight) => {
    const key = `${flight.route_id}:${flight.aircraft_id}:${flight.departure_at}`;
    if (existingKeys.has(key)) {
      return false;
    }
    existingKeys.add(key);
    return true;
  });
}

async function flightRequest(request: Request, url: URL, config: BffConfig): Promise<Response> {
  if (request.method === "GET" && url.pathname === "/operations/flights") {
    return listFlights(request, url, config);
  }

  const completeMatch = /^\/operations\/flights\/([^/]+)\/complete$/.exec(url.pathname);
  if (request.method === "POST" && completeMatch?.[1]) {
    return completeFlight(request, config, decodeURIComponent(completeMatch[1]));
  }

  return jsonResponse({ error: { code: "OPERATIONS_NOT_FOUND", message: "Operations endpoint not found." } }, { status: 404 });
}

async function getScheduleOptions(request: Request, url: URL, config: BffConfig): Promise<Response> {
  const snapshot = await loadOperationsSnapshot(request, config);
  const routeId = url.searchParams.get("route_id") ?? snapshot.routes.find((route) => route.status === "awaiting_schedule")?.id;
  const route = snapshot.routes.find((item) => item.id === routeId) ?? null;
  const compatibleAircraft = snapshot.aircrafts.map((aircraft) => {
    const preview = route
      ? buildSchedulePreview(snapshot, {
        aircraft_id: aircraft.id,
        days_of_week: [1, 3, 5],
        departure_local_time: "09:00",
        route_id: route.id,
      })
      : null;

    return {
      aircraft,
      blockers: preview?.blockers ?? [],
      compatible: Boolean(preview?.canActivate),
      warnings: preview?.warnings ?? [],
    };
  });

  return jsonResponse({
    aircraft: compatibleAircraft,
    default_pattern: {
      days_of_week: [1, 3, 5],
      departure_local_time: "09:00",
      turnaround_minutes: 90,
    },
    route: route ? buildRouteListItem(route, snapshot) : null,
    routes: snapshot.routes.map((item) => buildRouteListItem(item, snapshot)),
  });
}

async function listFlights(request: Request, url: URL, config: BffConfig): Promise<Response> {
  const snapshot = await loadOperationsSnapshot(request, config);
  const status = url.searchParams.get("status");
  const flights = updateFlightStatuses(snapshot.flights)
    .filter((flight) => !status || flight.status === status)
    .filter((flight) => !url.searchParams.get("route_id") || flight.route_id === url.searchParams.get("route_id"))
    .filter((flight) => !url.searchParams.get("aircraft_id") || flight.aircraft_id === url.searchParams.get("aircraft_id"))
    .sort((left, right) => left.departure_at.localeCompare(right.departure_at));

  return jsonResponse({
    flights,
    summary: {
      completed: flights.filter((flight) => flight.status === "completed").length,
      live: flights.filter((flight) => flight.status === "boarding" || flight.status === "in_flight").length,
      upcoming: flights.filter((flight) => flight.status === "scheduled").length,
    },
  });
}

async function listSchedules(request: Request, config: BffConfig): Promise<Response> {
  const snapshot = await loadOperationsSnapshot(request, config);

  return jsonResponse({
    schedules: snapshot.schedules,
  });
}

async function loadOperationsSnapshot(request: Request, config: BffConfig): Promise<OperationsSnapshot> {
  const routeSnapshot = await loadRoutePlanningSnapshot(request, config);
  const airlineId = routeSnapshot.airline.id ?? "";
  const [routes, schedules, flights] = await Promise.all([
    listRoutesForAirline(airlineId),
    listSchedulesForAirline(airlineId),
    listFlightsForAirline(airlineId),
  ]);

  return {
    ...routeSnapshot,
    flights,
    routes,
    schedules,
  };
}

function operationErrorResponse(error: unknown): Response {
  if (error instanceof BackendHttpError) {
    return jsonResponse(error.toNormalizedJson(), { status: error.status });
  }
  const message = error instanceof Error ? error.message : "Operations request failed.";

  return jsonResponse({ error: { code: "OPERATIONS_ERROR", message } }, { status: 500 });
}

async function operationRequest(request: Request, url: URL, config: BffConfig): Promise<Response> {
  if (url.pathname.startsWith("/operations/flights")) {
    return flightRequest(request, url, config);
  }

  return scheduleRequest(request, url, config);
}

async function scheduleRequest(request: Request, url: URL, config: BffConfig): Promise<Response> {
  if (request.method === "GET" && url.pathname === "/operations/schedule-options") {
    return getScheduleOptions(request, url, config);
  }
  if (request.method === "POST" && url.pathname === "/operations/schedule-preview") {
    const snapshot = await loadOperationsSnapshot(request, config);
    const payload = await readJson<ScheduleRequest>(request);

    return jsonResponse({ preview: buildSchedulePreview(snapshot, payload) });
  }
  if (request.method === "POST" && url.pathname === "/operations/schedules") {
    return activateSchedule(request, config);
  }
  if (request.method === "GET" && url.pathname === "/operations/schedules") {
    return listSchedules(request, config);
  }

  return jsonResponse({ error: { code: "OPERATIONS_NOT_FOUND", message: "Operations endpoint not found." } }, { status: 404 });
}
