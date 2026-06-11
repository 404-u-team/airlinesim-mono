import type { BffConfig } from "../../config";
import type { RouteOpportunity, StoredRoute } from "../routes/types";
import type { OperationsSnapshot } from "./planning";
import type { StoredFlight } from "./types";

import { jsonResponse, readJson } from "../../http";
import { reconcileNotificationsAfterMutation } from "../events/reconcile";
import { buildRouteOpportunity } from "../routes/planning";
import { currentAircraftAirport } from "./aircraft-position";
import { buildOneTimeFlight } from "./flights";
import { currentFlightStatus, estimateBlockHours } from "./flights";
import { dedupeGeneratedFlights, loadOperationsSnapshot } from "./load";
import { saveFlights } from "./storage";

export type FerryFlightRequest = {
  aircraft_id?: string;
  departure_date?: string;
  departure_local_time?: string;
  destination_airport_id?: string;
};

export type FerryFlightResult = FerryError | { cancelledFlights: StoredFlight[]; flight: StoredFlight };

type FerryContext = FerryEntities & { opportunity: RouteOpportunity };

type FerryEntities = {
  aircraft: NonNullable<OperationsSnapshot["aircrafts"][number]>;
  destination: NonNullable<OperationsSnapshot["airports"][number]>;
  origin: NonNullable<OperationsSnapshot["airports"][number]>;
  type: NonNullable<OperationsSnapshot["aircraftTypes"][number]>;
};

type FerryError = { error: { code: string; message: string; reasons?: FerryReason[] } };

type FerryReason = { code: string; message: string };

// Plans a one-time ferry flight from the aircraft's *current* position to the chosen
// destination. Origin is derived (not user-supplied) so the aircraft is always in
// position; range/runway compatibility is still enforced.
export function buildFerryFlight(snapshot: OperationsSnapshot, payload: FerryFlightRequest): FerryFlightResult {
  const resolved = resolveFerryContext(snapshot, payload);
  if ("error" in resolved) {
    return resolved;
  }

  const { aircraft, destination, opportunity, origin, type } = resolved;
  const route = syntheticRoute(snapshot, opportunity, origin.id ?? "", destination.id ?? "", aircraft.id ?? "", type.id ?? "");
  const departureAt = ferryDeparture(payload);
  const flight = buildOneTimeFlight(snapshot, route, aircraft, type, origin, destination, departureAt);
  const now = new Date().toISOString();
  const cancelledFlights = getOverlappingFlights(snapshot, aircraft.id ?? "", payload, opportunity).map((f) => ({
    ...f,
    status: "cancelled" as const,
    updated_at: now,
  }));

  return { cancelledFlights, flight };
}

export async function createFerryFlightResponse(request: Request, config: BffConfig): Promise<Response> {
  const snapshot = await loadOperationsSnapshot(request, config);
  const payload = await readJson<FerryFlightRequest>(request);
  const result = buildFerryFlight(snapshot, payload);

  if ("error" in result) {
    const status = result.error.code === "AIRCRAFT_NOT_FOUND" || result.error.code === "MISSING_AIRPORT" ? 404 : 400;

    return jsonResponse({ error: result.error }, { status });
  }

  await saveFlights(dedupeGeneratedFlights(snapshot.flights, [...result.cancelledFlights, result.flight]));
  await reconcileNotificationsAfterMutation(request, config);

  return jsonResponse({ flight: result.flight }, { status: 201 });
}

function ferryAvailabilityError(
  opportunity: RouteOpportunity,
  aircraftId: string,
): FerryError | null {
  const blockers = ferryBlockers(opportunity, aircraftId);
  if (blockers.length > 0) {
    return { error: { code: "FERRY_BLOCKED", message: "Aircraft cannot fly this ferry leg.", reasons: blockers } };
  }

  return null;
}

function ferryBlockers(opportunity: RouteOpportunity, aircraftId: string): FerryReason[] {
  // Ferry origin is the aircraft's own position, so ignore route-level hub/position
  // constraints; only the selected aircraft's range/runway compatibility matters.
  const option = opportunity.compatible_aircraft.find((item) => item.aircraft.id === aircraftId);

  return (option?.blockers ?? []).map((reason) => ({ code: reason.code, message: reason.message }));
}

function ferryDeparture(payload: FerryFlightRequest): Date {
  const dateStr = payload.departure_date ?? new Date().toISOString().slice(0, 10);
  const timeStr = payload.departure_local_time ?? "09:00";

  return new Date(`${dateStr}T${timeStr}:00.000Z`);
}

function getOverlappingFlights(
  snapshot: OperationsSnapshot,
  aircraftId: string,
  payload: FerryFlightRequest,
  opportunity: RouteOpportunity,
): StoredFlight[] {
  const departureAt = ferryDeparture(payload).getTime();
  const blockHours = Math.max(0.75, opportunity.demand.distance_km / 740 + 0.35);
  const arrivalAt = departureAt + blockHours * 60 * 60_000;

  return snapshot.flights.filter((flight) => {
    if (flight.aircraft_id !== aircraftId || flight.status === "cancelled" || flight.status === "completed") {
      return false;
    }
    const otherDeparture = new Date(flight.departure_at).getTime();
    const otherArrival = new Date(flight.arrival_at).getTime();

    return departureAt < otherArrival && otherDeparture < arrivalAt;
  });
}

function resolveFerryContext(snapshot: OperationsSnapshot, payload: FerryFlightRequest): FerryContext | FerryError {
  const entities = resolveFerryEntities(snapshot, payload);
  if ("error" in entities) {
    return entities;
  }

  const { aircraft, destination, origin } = entities;
  const opportunity = buildRouteOpportunity(snapshot, origin.id ?? "", destination.id ?? "", [], aircraft.id);
  if (!opportunity) {
    return { error: { code: "FERRY_PREVIEW_FAILED", message: "Could not build ferry preview." } };
  }

  const availabilityError = ferryAvailabilityError(opportunity, aircraft.id ?? "");
  if (availabilityError) {
    return availabilityError;
  }

  return { ...entities, opportunity };
}

function resolveFerryEntities(snapshot: OperationsSnapshot, payload: FerryFlightRequest): FerryEntities | FerryError {
  const aircraft = snapshot.aircrafts.find((item) => item.id === payload.aircraft_id);
  const type = snapshot.aircraftTypes.find((item) => item.id === aircraft?.type_id);

  if (!aircraft?.id || !type) {
    return { error: { code: "AIRCRAFT_NOT_FOUND", message: "Aircraft not found." } };
  }
  if (aircraft.status === "maintenance") {
    return { error: { code: "AIRCRAFT_NOT_READY", message: "Aircraft is in maintenance." } };
  }

  const originId = currentAircraftAirport(aircraft.id, snapshot.flights, aircraft.base_airport_id ?? snapshot.airline.starting_airport_id);
  const destinationId = payload.destination_airport_id ?? "";

  if (!originId || !destinationId || originId === destinationId) {
    return { error: { code: "INVALID_FERRY_ROUTE", message: "Choose a destination other than the aircraft's current airport." } };
  }

  const origin = snapshot.airports.find((item) => item.id === originId);
  const destination = snapshot.airports.find((item) => item.id === destinationId);

  if (!origin || !destination) {
    return { error: { code: "MISSING_AIRPORT", message: "Airport data is missing." } };
  }

  return { aircraft, destination, origin, type };
}

function syntheticRoute(
  snapshot: OperationsSnapshot,
  opportunity: RouteOpportunity,
  originId: string,
  destinationId: string,
  aircraftId: string,
  typeId: string,
): StoredRoute {
  const now = new Date().toISOString();

  return {
    airline_id: snapshot.airline.id ?? "",
    base_frequency_per_week: 1,
    constraints_snapshot: opportunity.constraints,
    created_at: now,
    demand_snapshot: opportunity.demand,
    destination_airport_id: destinationId,
    economics_snapshot: opportunity.economics,
    id: `ferry-route-${originId}-${destinationId}`,
    origin_airport_id: originId,
    selected_aircraft_id: aircraftId,
    selected_aircraft_type_id: typeId,
    status: "active",
    updated_at: now,
    warnings_snapshot: opportunity.warnings,
  };
}
