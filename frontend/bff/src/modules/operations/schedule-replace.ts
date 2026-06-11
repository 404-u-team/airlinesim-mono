import type { SchedulePreview, StoredFlight, StoredSchedule } from "./types";

import { buildSchedulePreview, createScheduleFromPreview, type OperationsSnapshot } from "./planning";

export type GroupedSchedulePattern = {
  days_of_week: number[];
  departure_local_time: string;
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
  blocks?: Array<{ day?: number; departure_local_time?: string; route_id?: string }>;
  round_trip?: boolean;
  turnaround_minutes?: number;
};

export type ScheduleBlockInput = {
  day: number;
  departure_local_time: string;
  route_id: string;
};

/**
 * Collapse per-day blocks into schedule patterns: blocks that share the same route and
 * departure time become one pattern with multiple `days_of_week`.
 */
export function groupBlocksIntoPatterns(blocks: ScheduleBlockInput[]): GroupedSchedulePattern[] {
  const groups = new Map<string, GroupedSchedulePattern>();

  for (const block of blocks) {
    const key = `${block.route_id}::${block.departure_local_time}`;
    const existing = groups.get(key);

    if (existing) {
      if (!existing.days_of_week.includes(block.day)) {
        existing.days_of_week.push(block.day);
      }
    } else {
      groups.set(key, {
        days_of_week: [block.day],
        departure_local_time: block.departure_local_time,
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
    .filter((block): block is { day: number; departure_local_time: string; route_id: string } =>
      typeof block.route_id === "string" && typeof block.departure_local_time === "string" && typeof block.day === "number")
    .map((block) => ({ day: block.day, departure_local_time: block.departure_local_time, route_id: block.route_id }));
}

/**
 * Rebuild the entire weekly schedule for a single aircraft from a flat list of blocks.
 * The aircraft's existing schedules and its future (still-scheduled) flights are stripped from
 * the working snapshot first, so the new layout validates against flight history only — this
 * avoids spurious AIRCRAFT_CONFLICT / AIRCRAFT_OUT_OF_POSITION blockers against itself.
 */
export function replaceAircraftSchedule(snapshot: OperationsSnapshot, input: ReplaceScheduleInput): {
  flights: StoredFlight[];
  previews: SchedulePreview[];
  removedScheduleIds: string[];
  schedules: StoredSchedule[];
} {
  const aircraftId = input.aircraft_id ?? "";
  const removedScheduleIds = snapshot.schedules
    .filter((schedule) => schedule.aircraft_id === aircraftId)
    .map((schedule) => schedule.id);
  const removedSet = new Set(removedScheduleIds);

  const schedules: StoredSchedule[] = [];
  const flights: StoredFlight[] = [];
  const previews: SchedulePreview[] = [];

  // Each pattern validates against history plus the patterns already placed in this request.
  let working: OperationsSnapshot = {
    ...snapshot,
    flights: snapshot.flights.filter(
      (flight) => !(flight.aircraft_id === aircraftId && flight.status === "scheduled"),
    ),
    schedules: snapshot.schedules.filter((schedule) => !removedSet.has(schedule.id)),
  };

  for (const pattern of groupBlocksIntoPatterns(input.blocks)) {
    const patternInput = {
      aircraft_id: aircraftId,
      days_of_week: pattern.days_of_week,
      departure_local_time: pattern.departure_local_time,
      round_trip: input.round_trip ?? true,
      route_id: pattern.route_id,
      turnaround_minutes: input.turnaround_minutes,
    };
    const preview = buildSchedulePreview(working, patternInput);
    const { flights: patternFlights, schedule } = createScheduleFromPreview(working, patternInput, preview);

    schedules.push(schedule);
    flights.push(...patternFlights);
    previews.push(preview);

    working = {
      ...working,
      flights: [...working.flights, ...patternFlights],
      schedules: [...working.schedules, schedule],
    };
  }

  return { flights, previews, removedScheduleIds, schedules };
}
