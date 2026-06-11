import type { BffConfig } from "../../config";
import type { StoredFlight, StoredSchedule } from "./types";

import { BackendHttpError } from "../../backend-http";
import { jsonResponse, readJson } from "../../http";
import { recordGameEvent } from "../events/producer";
import { reconcileNotificationsAfterMutation } from "../events/reconcile";
import { reconcileCompletedFlight } from "../finance/ledger";
import { enrichOwnedAircraft } from "../fleet/scoring";
import { buildRouteListItem } from "../routes/planning";
import { saveRoute } from "../routes/storage";
import { annotateOutOfPosition } from "./aircraft-position";
import { createFerryFlightResponse } from "./ferry";
import { attachAirportRefs } from "./flight-airports";
import { cancelFlight } from "./flight-cancel";
import { recordCompletedFlightEvents, recordScheduleReplacedEvent } from "./flight-events";
import { flightAircraftSummary, flightTelemetryFor } from "./flight-read";
import { updateFlightStatuses } from "./flights";
import { dedupeGeneratedFlights, loadOperationsSnapshot } from "./load";
import { buildSchedulePreview, createScheduleFromPreview, type OperationsSnapshot } from "./planning";
import { normalizeReplaceBlocks, replaceAircraftSchedule, type ReplaceScheduleRequest } from "./schedule-replace";
import { deleteFutureFlightsForSchedules, deleteSchedulesForAircraft, saveFlights, saveSchedule } from "./storage";

type ScheduleRequest = {
  aircraft_id?: string;
  days_of_week?: number[];
  departure_local_time?: string;
  round_trip?: boolean;
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
  if (schedule.status === "active") {
    await recordGameEvent({
      airline_id: snapshot.airline.id ?? "",
      category: "operations",
      code: "SCHEDULE_ACTIVATED",
      dedupe_key: `schedule-activated:${schedule.id}`,
      occurred_at: schedule.created_at,
      parameters: {
        aircraft_id: schedule.aircraft_id,
        flights_generated: flights.length,
        route_id: schedule.route_id,
        weekly_frequency: schedule.pattern.days_of_week.length,
        weekly_profit: preview.economics.weekly_profit,
      },
      related: { aircraft_id: schedule.aircraft_id, route_id: schedule.route_id, schedule_id: schedule.id },
      severity: "success",
      source_id: schedule.id,
      source_type: "schedule",
      target_path: "/operations/live-flights",
    });
  }
  await reconcileNotificationsAfterMutation(request, config);

  return jsonResponse({ flights, preview, schedule }, { status: 201 });
}

async function completeFlight(request: Request, config: BffConfig, flightId: string): Promise<Response> {
  const snapshot = await loadOperationsSnapshot(request, config);
  const flight = snapshot.flights.find((item) => item.id === flightId);

  if (!flight) {
    return jsonResponse({ error: { code: "FLIGHT_NOT_FOUND", message: "Flight not found." } }, { status: 404 });
  }
  if (flight.status !== "completed" && new Date(flight.arrival_at).getTime() > Date.now()) {
    return jsonResponse(
      { error: { code: "FLIGHT_NOT_ARRIVED", message: "Flight has not arrived yet and is settled automatically." } },
      { status: 409 },
    );
  }

  const completedFlight = {
    ...flight,
    actual: flight.actual ?? flight.expected,
    status: "completed" as const,
    updated_at: new Date().toISOString(),
  };
  await saveFlights([completedFlight]);
  const ledgerTransactions = await reconcileCompletedFlight(completedFlight);
  await recordCompletedFlightEvents(snapshot.airline.id ?? "", completedFlight, ledgerTransactions.length);
  await reconcileNotificationsAfterMutation(request, config);

  return jsonResponse({ flight: completedFlight });
}

// Everything the single-flight page needs: the flight with live financials, resolved
// airports (+ coordinates), the synthesized telemetry/phase and an aircraft summary.
async function flightDetail(request: Request, config: BffConfig, flightId: string): Promise<Response> {
  const snapshot = await loadOperationsSnapshot(request, config);
  const annotated = annotateOutOfPosition(
    updateFlightStatuses(snapshot.flights),
    snapshot.aircrafts,
    snapshot.airline.starting_airport_id,
  );
  const flight = annotated.find((item) => item.id === flightId);

  if (!flight) {
    return jsonResponse({ error: { code: "FLIGHT_NOT_FOUND", message: "Flight not found." } }, { status: 404 });
  }

  const [withAirports] = attachAirportRefs([flight], snapshot.airports);
  const aircraft = flightAircraftSummary(flight, snapshot);

  return jsonResponse({
    aircraft,
    flight: { ...withAirports, ...flightTelemetryFor(flight, snapshot) },
    route_id: flight.route_id,
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

  const cancelMatch = /^\/operations\/flights\/([^/]+)\/cancel$/.exec(url.pathname);
  if (request.method === "POST" && cancelMatch?.[1]) {
    return cancelFlight(request, config, decodeURIComponent(cancelMatch[1]));
  }

  const detailMatch = /^\/operations\/flights\/([^/]+)$/.exec(url.pathname);
  if (request.method === "GET" && detailMatch?.[1]) {
    return flightDetail(request, config, decodeURIComponent(detailMatch[1]));
  }

  return jsonResponse({ error: { code: "OPERATIONS_NOT_FOUND", message: "Operations endpoint not found." } }, { status: 404 });
}

async function getScheduleOptions(request: Request, url: URL, config: BffConfig): Promise<Response> {
  const snapshot = await loadOperationsSnapshot(request, config);
  const routeId = url.searchParams.get("route_id") ?? snapshot.routes.find((route) => route.status === "awaiting_schedule")?.id;
  const route = snapshot.routes.find((item) => item.id === routeId) ?? null;
  const compatibleAircraft = snapshot.aircrafts.map((aircraft) => {
    const enriched = enrichOwnedAircraft(aircraft, snapshot.aircraftTypes, snapshot.airports);
    const preview = route
      ? buildSchedulePreview(snapshot, {
        aircraft_id: aircraft.id,
        days_of_week: [1, 3, 5],
        departure_local_time: "09:00",
        route_id: route.id,
      })
      : null;

    return {
      aircraft: enriched,
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
      round_trip: true,
      turnaround_minutes: 90,
    },
    route: route ? buildRouteListItem(route, snapshot) : null,
    routes: snapshot.routes.map((item) => buildRouteListItem(item, snapshot)),
    schedules: snapshot.schedules,
  });
}

async function listFlights(request: Request, url: URL, config: BffConfig): Promise<Response> {
  const snapshot = await loadOperationsSnapshot(request, config);
  const status = url.searchParams.get("status");
  // Annotate position consistency before filtering, since it depends on the full set
  // of the aircraft's flights, not just the filtered slice.
  const annotated = annotateOutOfPosition(updateFlightStatuses(snapshot.flights), snapshot.aircrafts, snapshot.airline.starting_airport_id);
  const flights = attachAirportRefs(
    annotated
      .filter((flight) => !status || flight.status === status)
      .filter((flight) => !url.searchParams.get("route_id") || flight.route_id === url.searchParams.get("route_id"))
      .filter((flight) => !url.searchParams.get("aircraft_id") || flight.aircraft_id === url.searchParams.get("aircraft_id"))
      .sort((left, right) => left.departure_at.localeCompare(right.departure_at)),
    snapshot.airports,
  ).map((flight) => ({ ...flight, ...flightTelemetryFor(flight, snapshot) }));

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

async function markRoutesScheduled(snapshot: OperationsSnapshot, schedules: StoredSchedule[]): Promise<void> {
  const now = new Date().toISOString();
  const routeIds = new Set(schedules.filter((schedule) => schedule.status === "active").map((schedule) => schedule.route_id));

  await Promise.all([...routeIds].map(async (routeId) => {
    const route = snapshot.routes.find((item) => item.id === routeId);
    if (route) {
      await saveRoute({ ...route, status: "scheduled", updated_at: now });
    }
  }));
}

function operationErrorResponse(error: unknown): Response {
  if (error instanceof BackendHttpError) {
    return jsonResponse(error.toNormalizedJson(), { status: error.status });
  }
  const message = error instanceof Error ? error.message : "Operations request failed.";

  return jsonResponse({ error: { code: "OPERATIONS_ERROR", message } }, { status: 500 });
}

async function operationRequest(request: Request, url: URL, config: BffConfig): Promise<Response> {
  if (request.method === "POST" && url.pathname === "/operations/ferry-flights") {
    return createFerryFlightResponse(request, config);
  }

  const routeDetailMatch = /^\/operations\/routes\/([^/]+)\/detail$/.exec(url.pathname);
  if (request.method === "GET" && routeDetailMatch?.[1]) {
    return routeDetail(request, config, decodeURIComponent(routeDetailMatch[1]));
  }
  if (url.pathname.startsWith("/operations/flights")) {
    return flightRequest(request, url, config);
  }

  return scheduleRequest(request, url, config);
}

async function replaceSchedules(request: Request, config: BffConfig): Promise<Response> {
  const loaded = await loadOperationsSnapshot(request, config);
  // Statuses are derived live: a stored "scheduled" row may already be airborne, and the
  // rotation-protection logic below relies on seeing the real in_flight/completed state.
  const snapshot: OperationsSnapshot = { ...loaded, flights: updateFlightStatuses(loaded.flights) };
  const payload = await readJson<ReplaceScheduleRequest>(request);
  const aircraftId = payload.aircraft_id ?? "";

  if (!aircraftId) {
    return jsonResponse({ error: { code: "AIRCRAFT_REQUIRED", message: "aircraft_id is required." } }, { status: 400 });
  }

  const { flights, previews, protectedFlights, schedules } = replaceAircraftSchedule(snapshot, {
    aircraft_id: aircraftId,
    blocks: normalizeReplaceBlocks(payload.blocks),
    round_trip: payload.round_trip,
    turnaround_minutes: payload.turnaround_minutes,
  });
  const protectedIds = new Set(protectedFlights.map((flight) => flight.id));

  // Drop the aircraft's old schedules and their future flights — except the in-progress
  // rotation legs — then persist the rebuilt set. Dedupe the rebuilt flights against
  // everything *except* the aircraft's own future flights we are replacing, so an
  // unchanged leg is not deduped away and then lost.
  const keptFlights = snapshot.flights.filter(
    (flight) => !(flight.aircraft_id === aircraftId && flight.status === "scheduled" && !protectedIds.has(flight.id)),
  );
  const removedScheduleIds = await deleteSchedulesForAircraft(snapshot.airline.id ?? "", aircraftId);
  await deleteFutureFlightsForSchedules(removedScheduleIds, [...protectedIds]);
  await Promise.all(schedules.map(saveSchedule));
  if (flights.length > 0) {
    await saveFlights(dedupeGeneratedFlights(keptFlights, flights));
  }
  await markRoutesScheduled(snapshot, schedules);
  await recordScheduleReplacedEvent(snapshot, schedules, previews.reduce((sum, preview) => sum + preview.economics.weekly_profit, 0), flights.length);
  await reconcileNotificationsAfterMutation(request, config);

  return jsonResponse({ flights, previews, schedules }, { status: 200 });
}

// Aggregates everything the "My Routes" detail page needs: the route with live
// economics, two-way demand, all schedules on it, the next departures, and the
// aircraft currently or soon flying it.
async function routeDetail(request: Request, config: BffConfig, routeId: string): Promise<Response> {
  const snapshot = await loadOperationsSnapshot(request, config);
  const route = snapshot.routes.find((item) => item.id === routeId);

  if (!route) {
    return jsonResponse({ error: { code: "ROUTE_NOT_FOUND", message: "Route not found." } }, { status: 404 });
  }

  const now = Date.now();
  // Show only departures in the next 7 days, capped at 5 — whichever is fewer.
  const horizon = now + 7 * 24 * 60 * 60_000;
  const routeFlights = updateFlightStatuses(snapshot.flights).filter((flight) => flight.route_id === routeId);
  const upcomingFlights = attachAirportRefs(
    routeFlights
      .filter((flight) => {
        const departure = new Date(flight.departure_at).getTime();
        return flight.status !== "cancelled" && departure >= now && departure <= horizon;
      })
      .sort((left, right) => left.departure_at.localeCompare(right.departure_at))
      .slice(0, 5),
    snapshot.airports,
  );
  const schedules = snapshot.schedules.filter((schedule) => schedule.route_id === routeId);
  const aircraftIds = new Set<string>([
    ...schedules.map((schedule) => schedule.aircraft_id),
    ...routeFlights
      .filter((flight) => flight.status !== "cancelled" && new Date(flight.arrival_at).getTime() >= now)
      .map((flight) => flight.aircraft_id),
  ]);
  const aircraft = snapshot.aircrafts
    .filter((item) => aircraftIds.has(item.id ?? ""))
    .map((item) => enrichOwnedAircraft(item, snapshot.aircraftTypes, snapshot.airports));

  return jsonResponse({
    aircraft,
    demand: {
      average_daily_passengers: Math.round(
        (route.demand_snapshot.origin_daily_passengers + route.demand_snapshot.destination_daily_passengers) / 2,
      ),
      destination_daily_passengers: route.demand_snapshot.destination_daily_passengers,
      distance_km: route.demand_snapshot.distance_km,
      origin_daily_passengers: route.demand_snapshot.origin_daily_passengers,
    },
    fare: {
      outbound: route.fare_override_outbound ?? null,
      return: route.fare_override_return ?? null,
    },
    route: buildRouteListItem(route, snapshot),
    schedules,
    upcoming_flights: upcomingFlights,
  });
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
  if (request.method === "PUT" && url.pathname === "/operations/schedules") {
    return replaceSchedules(request, config);
  }
  if (request.method === "GET" && url.pathname === "/operations/schedules") {
    return listSchedules(request, config);
  }

  return jsonResponse({ error: { code: "OPERATIONS_NOT_FOUND", message: "Operations endpoint not found." } }, { status: 404 });
}
