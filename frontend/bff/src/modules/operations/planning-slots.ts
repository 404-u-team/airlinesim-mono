import type { AirportConstraint } from "../facilities/types";
import type { AircraftType, Airport } from "../fleet/types";
import type { StoredRoute } from "../routes/types";
import type { OperationsSnapshot } from "./planning";
import type { SchedulePattern } from "./types";

import { arrivalLocalDayOffset, arrivalLocalTime } from "../facilities/constraints";
import { buildSlotCapacity, slotCapacityConstraints } from "../facilities/slots";
import { estimateBlockHours } from "./flights";
import { addMinutesToLocalTime } from "./schedule-time";

export function buildRoundTripSlotConstraints(
  snapshot: OperationsSnapshot,
  route: StoredRoute | undefined,
  type: AircraftType | undefined,
  origin: Airport | undefined,
  destination: Airport | undefined,
  pattern: SchedulePattern,
): AirportConstraint[] {
  const offsets = roundTripDayOffsets(route, type, origin, destination, pattern);

  return [
    ...slotCapacityConstraints(origin, buildSlotCapacity(origin, snapshot.routes, snapshot.schedules, snapshot.flights, combineUses(
      projectedUses(pattern),
      projectedUses(pattern, offsets.returnArrival),
    ))),
    ...slotCapacityConstraints(destination, buildSlotCapacity(destination, snapshot.routes, snapshot.schedules, snapshot.flights, combineUses(
      projectedUses(pattern, offsets.destinationArrival),
      projectedUses(pattern, offsets.returnDeparture),
    ))),
  ];
}

function combineUses(...uses: Array<Partial<Record<number, number>>>): Partial<Record<number, number>> {
  const result: Partial<Record<number, number>> = {};

  for (const useMap of uses) {
    for (const [day, count] of Object.entries(useMap)) {
      const key = Number(day);
      result[key] = (result[key] ?? 0) + (count ?? 0);
    }
  }

  return result;
}

function projectedUses(pattern: SchedulePattern, dayOffset = 0): Partial<Record<number, number>> {
  return Object.fromEntries(pattern.days_of_week.map((day) => [((day + dayOffset) % 7 + 7) % 7, 1]));
}

function roundTripDayOffsets(
  route: StoredRoute | undefined,
  type: AircraftType | undefined,
  origin: Airport | undefined,
  destination: Airport | undefined,
  pattern: SchedulePattern,
): { destinationArrival: number; returnArrival: number; returnDeparture: number } {
  const destinationArrival = arrivalLocalDayOffset(
    pattern.departure_local_time,
    estimateBlockHours(route, type),
    origin?.timezone,
    destination?.timezone,
  );
  const arrivalTime = arrivalLocalTime(
    pattern.departure_local_time,
    estimateBlockHours(route, type),
    origin?.timezone,
    destination?.timezone,
  );
  const returnDeparture = addMinutesToLocalTime(arrivalTime ?? "12:00", pattern.turnaround_minutes);
  const returnDepartureOffset = destinationArrival + returnDeparture.dayOffset;
  const returnArrival = returnDepartureOffset + arrivalLocalDayOffset(
    returnDeparture.time,
    estimateBlockHours(route, type),
    destination?.timezone,
    origin?.timezone,
  );

  return {
    destinationArrival,
    returnArrival,
    returnDeparture: returnDepartureOffset,
  };
}
