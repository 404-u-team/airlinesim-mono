import type { SchedulePreview, StoredFlight, StoredSchedule } from "./types";

import { rotationProtectedFlights } from "./aircraft-position";
import { buildSchedulePreview, createScheduleFromPreview, type OperationsSnapshot } from "./planning";

export type GroupedSchedulePattern = {
  days_of_week: number[];
  departure_local_time: string;
  round_trip: boolean;
  route_id: string;
};

export type ReplaceScheduleInput = {
  aircraft_id?: string;
  blocks: ScheduleBlockInput[];
  round_trip?: boolean;
  turnaround_minutes?: number;
};

export type ReplaceScheduleRequest = {
  aircraft_id?: string;
  blocks?: Array<{ day?: number; departure_local_time?: string; round_trip?: boolean; route_id?: string }>;
  round_trip?: boolean;
  turnaround_minutes?: number;
};

export type ScheduleBlockInput = {
  day: number;
  departure_local_time: string;
  round_trip?: boolean;
  route_id: string;
};

/**
 * Collapse per-day blocks into schedule patterns: blocks that share the same route,
 * departure time and trip mode become one pattern with multiple `days_of_week`.
 */
export function groupBlocksIntoPatterns(blocks: ScheduleBlockInput[], defaultRoundTrip = true): GroupedSchedulePattern[] {
  const groups = new Map<string, GroupedSchedulePattern>();

  for (const block of blocks) {
    const roundTrip = block.round_trip ?? defaultRoundTrip;
    const key = `${block.route_id}::${block.departure_local_time}::${roundTrip ? "rt" : "ow"}`;
    const existing = groups.get(key);

    if (existing) {
      if (!existing.days_of_week.includes(block.day)) {
        existing.days_of_week.push(block.day);
      }
    } else {
      groups.set(key, {
        days_of_week: [block.day],
        departure_local_time: block.departure_local_time,
        round_trip: roundTrip,
        route_id: block.route_id,
      });
    }
  }

  return [...groups.values()].map((group) => ({
    ...group,
    days_of_week: [...group.days_of_week].sort((left, right) => left - right),
  }));
}

/** Keep only well-formed blocks from an untrusted request body. */
export function normalizeReplaceBlocks(blocks: ReplaceScheduleRequest["blocks"]): ScheduleBlockInput[] {
  return (blocks ?? [])
    .filter((block): block is { day: number; departure_local_time: string; round_trip?: boolean; route_id: string } =>
      typeof block.route_id === "string" && typeof block.departure_local_time === "string" && typeof block.day === "number")
    .map((block) => ({
      day: block.day,
      departure_local_time: block.departure_local_time,
      ...(typeof block.round_trip === "boolean" ? { round_trip: block.round_trip } : {}),
      route_id: block.route_id,
    }));
}

/**
 * Rebuild the entire weekly schedule for a single aircraft from a flat list of blocks.
 * The aircraft's existing schedules and its future (still-scheduled) flights are stripped from
 * the working snapshot first — except the rotation already in progress (a departed leg and
 * the chained return that brings the aircraft home), which is preserved so the aircraft is
 * never stranded mid-trip. New flights only start once that rotation has completed.
 */
export function replaceAircraftSchedule(snapshot: OperationsSnapshot, input: ReplaceScheduleInput): {
  flights: StoredFlight[];
  previews: SchedulePreview[];
  protectedFlights: StoredFlight[];
  removedScheduleIds: string[];
  schedules: StoredSchedule[];
} {
  const aircraftId = input.aircraft_id ?? "";
  const removedScheduleIds = snapshot.schedules
    .filter((schedule) => schedule.aircraft_id === aircraftId)
    .map((schedule) => schedule.id);
  const removedSet = new Set(removedScheduleIds);
  const protectedFlights = rotationProtectedFlights(aircraftId, snapshot.flights);
  const protectedIds = new Set(protectedFlights.map((flight) => flight.id));
  // The new plan takes over only after the in-progress rotation lands.
  const availableAfterMs = protectedFlights.reduce(
    (latest, flight) => Math.max(latest, new Date(flight.arrival_at).getTime()),
    0,
  );

  const schedules: StoredSchedule[] = [];
  const flights: StoredFlight[] = [];
  const previews: SchedulePreview[] = [];

  // Each pattern validates against history plus the patterns already placed in this request.
  let working: OperationsSnapshot = {
    ...snapshot,
    flights: snapshot.flights.filter(
      (flight) => !(flight.aircraft_id === aircraftId && flight.status === "scheduled" && !protectedIds.has(flight.id)),
    ),
    schedules: snapshot.schedules.filter((schedule) => !removedSet.has(schedule.id)),
  };

  for (const pattern of groupBlocksIntoPatterns(input.blocks, input.round_trip ?? true)) {
    const patternInput = {
      aircraft_id: aircraftId,
      days_of_week: pattern.days_of_week,
      departure_local_time: pattern.departure_local_time,
      round_trip: pattern.round_trip,
      route_id: pattern.route_id,
      turnaround_minutes: input.turnaround_minutes,
    };
    const preview = buildSchedulePreview(working, patternInput);
    const { flights: patternFlights, schedule } = createScheduleFromPreview(working, patternInput, preview);
    const startableFlights = dropFlightsBeforeRotationEnd(patternFlights, availableAfterMs);

    schedules.push(schedule);
    flights.push(...startableFlights);
    previews.push(preview);

    working = {
      ...working,
      flights: [...working.flights, ...startableFlights],
      schedules: [...working.schedules, schedule],
    };
  }

  return { flights, previews, protectedFlights, removedScheduleIds, schedules };
}

// Drops generated departures the aircraft cannot make because it is still flying the
// old rotation. Pairs are kept atomic: when an outbound is dropped, its return leg
// (the immediately following generated flight of the same rotation) is dropped too.
function dropFlightsBeforeRotationEnd(generated: StoredFlight[], availableAfterMs: number): StoredFlight[] {
  if (availableAfterMs <= 0) {
    return generated;
  }

  const kept: StoredFlight[] = [];
  let dropChainedReturn = false;

  for (const flight of generated) {
    const isReturnLeg = flight.flight_number.endsWith("R");
    if (isReturnLeg && dropChainedReturn) {
      dropChainedReturn = false;
      continue;
    }
    dropChainedReturn = false;
    if (new Date(flight.departure_at).getTime() < availableAfterMs) {
      if (!isReturnLeg) {
        dropChainedReturn = true;
      }
      continue;
    }
    kept.push(flight);
  }

  return kept;
}
