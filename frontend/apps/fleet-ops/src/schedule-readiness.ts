import type { ScheduleBlock } from "./components/useScheduleDrag";
import type { OperationRoute } from "./types";

export type ScheduleReadinessIssue = {
  blockId: string;
  day: number;
  expectedAirportId: string;
  originAirportId: string;
  routeId: string;
  time: string;
};

export type ScheduleReadinessReport = {
  /** Aircraft position once the weekly pattern has settled (after the last block). */
  endAirportId: null | string;
  issues: ScheduleReadinessIssue[];
  /** False when a week of flying leaves the aircraft at a different airport than it started. */
  periodic: boolean;
};

type SimulationState = {
  issueByBlock: Map<string, ScheduleReadinessIssue>;
  position: string;
};

/**
 * Simulates the aircraft position through the weekly plan and flags blocks whose
 * departure airport the aircraft will not actually be at (e.g. a one-way leg to
 * another hub without a scheduled leg back). The week is simulated twice so the
 * reported issues reflect the steady repeating state, not just the first week.
 */
export function analyzeScheduleReadiness(input: {
  blocks: ScheduleBlock[];
  routeById: Map<string, OperationRoute>;
  startAirportId?: string;
}): ScheduleReadinessReport {
  const ordered = sortBlocks(input.blocks);

  if (ordered.length === 0) {
    return { endAirportId: input.startAirportId ?? null, issues: [], periodic: true };
  }

  const firstRoute = input.routeById.get(ordered[0]?.routeId ?? "");
  const state: SimulationState = {
    issueByBlock: new Map(),
    position: input.startAirportId ?? firstRoute?.origin_airport_id ?? "",
  };

  simulateWeek(state, ordered, input.routeById);
  const positionAfterFirstWeek = state.position;
  simulateWeek(state, ordered, input.routeById);

  return {
    endAirportId: state.position || null,
    issues: sortBlocks([...state.issueByBlock.values()]),
    periodic: state.position === positionAfterFirstWeek,
  };
}

function simulateWeek(state: SimulationState, ordered: ScheduleBlock[], routeById: Map<string, OperationRoute>): void {
  for (const block of ordered) {
    const route = routeById.get(block.routeId);
    if (!route) {
      continue;
    }
    if (state.position && route.origin_airport_id !== state.position) {
      // Later passes overwrite earlier ones, so reported issues reflect steady state.
      state.issueByBlock.set(block.id, {
        blockId: block.id,
        day: block.day,
        expectedAirportId: state.position,
        originAirportId: route.origin_airport_id,
        routeId: block.routeId,
        time: block.time,
      });
      // The missed departure is auto-cancelled, so the aircraft stays where it is.
      continue;
    }
    state.issueByBlock.delete(block.id);
    state.position = block.oneWay ? route.destination_airport_id : route.origin_airport_id;
  }
}

function sortBlocks<TItem extends { day: number; time: string }>(items: TItem[]): TItem[] {
  return [...items].sort((left, right) =>
    left.day === right.day ? left.time.localeCompare(right.time) : left.day - right.day);
}
