import type { Aircraft } from "../fleet/types";
import type { StoredRoute } from "../routes/types";
import type { OperationsSnapshot } from "./planning";
import type { OperationReason, SchedulePattern } from "./types";

import { isHubOrigin } from "../routes/planning";
import { projectedAircraftAirport } from "./aircraft-position";

export function addOneWayBlocker(
  blockers: OperationReason[],
  snapshot: OperationsSnapshot,
  route: StoredRoute | undefined,
  pattern: SchedulePattern,
): void {
  if (pattern.round_trip || !route) {
    return;
  }
  if (!isHubOrigin(snapshot, route.origin_airport_id) || !isHubOrigin(snapshot, route.destination_airport_id)) {
    blockers.push({ code: "ONE_WAY_REQUIRES_HUBS", message: "One-way schedules are only allowed between your hubs." });
  }
}

// A mispositioned aircraft no longer blocks activation: the schedule stays active and
// only the departures the aircraft physically misses are auto-cancelled at read time.
export function addPositionWarning(
  warnings: OperationReason[],
  snapshot: OperationsSnapshot,
  route: StoredRoute | undefined,
  aircraft: Aircraft | undefined,
): void {
  if (!route || !aircraft?.id) {
    return;
  }

  // Position defaults to the aircraft's own base (its delivery hub), not the airline
  // base — otherwise an aircraft delivered to a secondary hub looks out of position.
  // The projection counts kept future flights, so a replacement issued mid-rotation
  // validates against where the aircraft lands after finishing the rotation.
  const homeBase = aircraft.base_airport_id ?? snapshot.airline.starting_airport_id;
  const location = projectedAircraftAirport(aircraft.id, snapshot.flights, homeBase);

  if (location && location !== route.origin_airport_id) {
    warnings.push({
      code: "AIRCRAFT_OUT_OF_POSITION",
      message: "Aircraft will not be at the route origin; departures it misses will be cancelled automatically.",
    });
  }
}
