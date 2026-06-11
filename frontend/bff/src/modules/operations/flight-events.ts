import type { OperationsSnapshot } from "./planning";
import type { StoredFlight, StoredSchedule } from "./types";

import { recordGameEvent } from "../events/producer";

export async function recordCompletedFlightEvents(
  airlineId: string,
  completedFlight: StoredFlight & { actual: NonNullable<StoredFlight["actual"]> },
  transactionCount: number,
): Promise<void> {
  await recordGameEvent({
    airline_id: airlineId,
    category: "operations",
    code: "FLIGHT_COMPLETED",
    dedupe_key: `flight-completed:${completedFlight.id}`,
    occurred_at: completedFlight.arrival_at,
    parameters: {
      cost: completedFlight.actual.cost,
      flight_number: completedFlight.flight_number,
      load_factor: completedFlight.actual.load_factor,
      passengers: completedFlight.actual.passengers,
      profit: completedFlight.actual.profit,
      revenue: completedFlight.actual.revenue,
    },
    related: {
      aircraft_id: completedFlight.aircraft_id,
      flight_id: completedFlight.id,
      route_id: completedFlight.route_id,
      schedule_id: completedFlight.schedule_id,
    },
    severity: completedFlight.actual.profit >= 0 ? "success" : "warning",
    source_id: completedFlight.id,
    source_type: "flight",
    target_path: `/finances/routes?route_id=${encodeURIComponent(completedFlight.route_id)}`,
  });
  await recordGameEvent({
    airline_id: airlineId,
    category: "finance",
    code: "FINANCE_RESULT_RECORDED",
    dedupe_key: `finance-result:${completedFlight.id}`,
    occurred_at: completedFlight.arrival_at,
    parameters: {
      profit: completedFlight.actual.profit,
      transaction_count: transactionCount,
    },
    related: {
      flight_id: completedFlight.id,
      route_id: completedFlight.route_id,
      schedule_id: completedFlight.schedule_id,
    },
    severity: completedFlight.actual.profit >= 0 ? "success" : "warning",
    source_id: completedFlight.id,
    source_type: "flight",
    target_path: `/finances/profit?flight_id=${encodeURIComponent(completedFlight.id)}`,
  });
}

export async function recordScheduleReplacedEvent(
  snapshot: OperationsSnapshot,
  schedules: StoredSchedule[],
  weeklyProfit: number,
  flightCount: number,
): Promise<void> {
  const active = schedules.filter((schedule) => schedule.status === "active");
  const primary = active[0];

  if (!primary) {
    return;
  }
  await recordGameEvent({
    airline_id: snapshot.airline.id ?? "",
    category: "operations",
    code: "SCHEDULE_ACTIVATED",
    dedupe_key: `schedule-replaced:${active.map((schedule) => schedule.id).join("-")}`,
    occurred_at: new Date().toISOString(),
    parameters: { aircraft_id: primary.aircraft_id, flights_generated: flightCount, schedules: active.length, weekly_profit: weeklyProfit },
    related: { aircraft_id: primary.aircraft_id, route_id: primary.route_id, schedule_id: primary.id },
    severity: "success",
    source_id: primary.id,
    source_type: "schedule",
    target_path: "/operations/live-flights",
  });
}
