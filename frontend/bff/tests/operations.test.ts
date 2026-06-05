import { expect, test } from "bun:test";

import type { OperationsSnapshot } from "../src/modules/operations/planning";
import type { StoredRoute } from "../src/modules/routes/types";

import { buildSchedulePreview, createScheduleFromPreview } from "../src/modules/operations/planning";

test("schedule activation derives stable schedule and flight ids", () => {
  const input = {
    aircraft_id: "aircraft-1",
    days_of_week: [1, 3, 5],
    departure_local_time: "09:00",
    route_id: "route-1",
    starts_on: "2026-06-08",
    turnaround_minutes: 90,
  };
  const snapshot = operationsSnapshot();
  const preview = buildSchedulePreview(snapshot, input);
  const first = createScheduleFromPreview(snapshot, input, preview);
  const second = createScheduleFromPreview(snapshot, input, preview);

  expect(first.schedule.id).toBe(second.schedule.id);
  expect(first.flights.map((flight) => flight.id)).toEqual(second.flights.map((flight) => flight.id));
  expect(new Set(first.flights.map((flight) => flight.id)).size).toBe(first.flights.length);
  expect(first.flights.every((flight) => flight.schedule_id === first.schedule.id)).toBe(true);
});

function operationsSnapshot(): OperationsSnapshot {
  const route: StoredRoute = {
    airline_id: "airline-1",
    base_frequency_per_week: 3,
    constraints_snapshot: [],
    created_at: "2026-06-05T00:00:00.000Z",
    demand_snapshot: {
      calculated_at: "2026-06-05T00:00:00.000Z",
      destination_daily_passengers: 420,
      distance_km: 1250,
      origin_daily_passengers: 430,
    },
    destination_airport_id: "airport-2",
    economics_snapshot: {
      confidence: "high",
      estimated_cost_per_flight: 15_000,
      estimated_fare_per_passenger: 180,
      estimated_profit_per_flight: 8_000,
      estimated_revenue_per_flight: 23_000,
      expected_load_factor: 0.82,
    },
    id: "route-1",
    origin_airport_id: "airport-1",
    selected_aircraft_id: "aircraft-1",
    status: "awaiting_schedule",
    updated_at: "2026-06-05T00:00:00.000Z",
    warnings_snapshot: [],
  };

  return {
    aircrafts: [
      {
        base_airport_id: "airport-1",
        current_maintenance_points: 100,
        id: "aircraft-1",
        max_maintenance_points_cached: 100,
        status: "idle",
        type_id: "type-1",
      },
    ],
    aircraftTypes: [
      {
        cruising_speed_kph: 760,
        fuel_consumption_per_hour: 2.5,
        id: "type-1",
        maint_cost_per_flight_hour: 500,
        max_planned_seat_capacity: 150,
        max_range_km: 4000,
        min_runway_length_m: 1800,
      },
    ],
    airline: {
      balance: 20_000_000,
      id: "airline-1",
      name: "Seoul Air",
      starting_airport_id: "airport-1",
    },
    airports: [
      {
        geog: "POINT (126.4505 37.4691)",
        id: "airport-1",
        max_runway_length_m: 3750,
        max_runway_uses_per_day: 600,
        timezone: "UTC",
        works_at_night: true,
      },
      {
        geog: "POINT (139.7798 35.5523)",
        id: "airport-2",
        max_runway_length_m: 3360,
        max_runway_uses_per_day: 500,
        timezone: "UTC",
        works_at_night: true,
      },
    ],
    countries: [],
    flights: [],
    regionLinks: [],
    regions: [],
    routes: [route],
    schedules: [],
  };
}
