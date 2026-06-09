import { expect, test } from "bun:test";

import type { OperationsSnapshot } from "../src/modules/operations/planning";
import type { StoredRoute } from "../src/modules/routes/types";

import type { StoredFlight } from "../src/modules/operations/types";

import { annotateOutOfPosition } from "../src/modules/operations/aircraft-position";
import { buildFerryFlight } from "../src/modules/operations/ferry";
import { buildSchedulePreview, createScheduleFromPreview } from "../src/modules/operations/planning";
import { groupBlocksIntoPatterns, replaceAircraftSchedule } from "../src/modules/operations/schedule-replace";

test("schedule activation derives stable schedule and flight ids", () => {
  const input = {
    aircraft_id: "aircraft-1",
    days_of_week: [1, 3, 5],
    departure_local_time: "09:00",
    route_id: "route-1",
    starts_on: "2030-01-07",
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

test("schedule activation creates round-trip flight pairs with turnaround", () => {
  const input = {
    aircraft_id: "aircraft-1",
    days_of_week: [1],
    departure_local_time: "09:00",
    route_id: "route-1",
    starts_on: "2030-01-07",
    turnaround_minutes: 120,
  };
  const snapshot = operationsSnapshot();
  const preview = buildSchedulePreview(snapshot, input);
  const result = createScheduleFromPreview(snapshot, input, preview);
  const [outbound, inbound] = result.flights;

  expect(result.flights).toHaveLength(4);
  expect(preview.sample_flights.slice(0, 2).map((flight) => flight.origin_airport_id)).toEqual([
    "airport-1",
    "airport-2",
  ]);
  expect(outbound.origin_airport_id).toBe("airport-1");
  expect(outbound.destination_airport_id).toBe("airport-2");
  expect(inbound.origin_airport_id).toBe("airport-2");
  expect(inbound.destination_airport_id).toBe("airport-1");
  expect(new Date(inbound.departure_at).getTime()).toBe(new Date(outbound.arrival_at).getTime() + 120 * 60_000);
});

test("one-way schedule generates a single leg per day", () => {
  const input = {
    aircraft_id: "aircraft-1",
    days_of_week: [1],
    departure_local_time: "09:00",
    round_trip: false,
    route_id: "route-1",
    starts_on: "2030-01-07",
    turnaround_minutes: 90,
  };
  const snapshot = operationsSnapshot();
  const preview = buildSchedulePreview(snapshot, input);
  const result = createScheduleFromPreview(snapshot, input, preview);

  expect(result.flights).toHaveLength(2);
  expect(result.flights.every((flight) => flight.origin_airport_id === "airport-1")).toBe(true);
});

test("scheduling is blocked when the aircraft is not at the route origin", () => {
  const snapshot = operationsSnapshot();
  snapshot.flights = [
    {
      aircraft_id: "aircraft-1",
      airline_id: "airline-1",
      arrival_at: "2026-06-06T10:00:00.000Z",
      created_at: "2026-06-06T08:00:00.000Z",
      departure_at: "2026-06-06T08:00:00.000Z",
      destination_airport_id: "airport-2",
      expected: { cost: 0, load_factor: 0.8, passengers: 100, profit: 0, revenue: 0 },
      flight_number: "AA01",
      id: "flight-x",
      origin_airport_id: "airport-1",
      route_id: "route-1",
      schedule_id: "schedule-x",
      status: "completed",
      updated_at: "2026-06-06T10:00:00.000Z",
    },
  ];
  const preview = buildSchedulePreview(snapshot, {
    aircraft_id: "aircraft-1",
    days_of_week: [1],
    departure_local_time: "09:00",
    route_id: "route-1",
    starts_on: "2030-01-07",
  });

  expect(preview.blockers.some((reason) => reason.code === "AIRCRAFT_OUT_OF_POSITION")).toBe(true);
  expect(preview.canActivate).toBe(false);
});

test("groupBlocksIntoPatterns merges shared route+time into one pattern and splits others", () => {
  const patterns = groupBlocksIntoPatterns([
    { day: 3, departure_local_time: "09:00", route_id: "route-1" },
    { day: 1, departure_local_time: "09:00", route_id: "route-1" },
    { day: 1, departure_local_time: "14:00", route_id: "route-1" },
  ]);

  expect(patterns).toHaveLength(2);
  const morning = patterns.find((pattern) => pattern.departure_local_time === "09:00");
  expect(morning?.days_of_week).toEqual([1, 3]);
  expect(patterns.find((pattern) => pattern.departure_local_time === "14:00")?.days_of_week).toEqual([1]);
});

test("replaceAircraftSchedule rebuilds the weekly schedule from blocks", () => {
  const snapshot = operationsSnapshot();
  const result = replaceAircraftSchedule(snapshot, {
    aircraft_id: "aircraft-1",
    blocks: [
      { day: 1, departure_local_time: "09:00", route_id: "route-1" },
      { day: 3, departure_local_time: "09:00", route_id: "route-1" },
    ],
    round_trip: true,
    turnaround_minutes: 90,
  });

  expect(result.schedules).toHaveLength(1);
  expect(result.schedules[0]?.pattern.days_of_week).toEqual([1, 3]);
  expect(result.schedules[0]?.status).toBe("active");
  expect(result.flights.every((flight) => flight.schedule_id === result.schedules[0]?.id)).toBe(true);
});

test("replaceAircraftSchedule ignores the aircraft's own future flights when validating", () => {
  const snapshot = operationsSnapshot();
  const futureFlight: StoredFlight = {
    aircraft_id: "aircraft-1",
    airline_id: "airline-1",
    arrival_at: "2026-06-15T11:00:00.000Z",
    created_at: "2026-06-07T08:00:00.000Z",
    departure_at: "2026-06-15T09:00:00.000Z",
    destination_airport_id: "airport-2",
    expected: { cost: 0, load_factor: 0.8, passengers: 100, profit: 0, revenue: 0 },
    flight_number: "AA09",
    id: "flight-future",
    origin_airport_id: "airport-1",
    route_id: "route-1",
    schedule_id: "schedule-old",
    status: "scheduled",
    updated_at: "2026-06-07T08:00:00.000Z",
  };
  snapshot.flights = [futureFlight];
  snapshot.schedules = [
    {
      aircraft_id: "aircraft-1",
      airline_id: "airline-1",
      checks_snapshot: [],
      created_at: "2026-06-07T08:00:00.000Z",
      id: "schedule-old",
      pattern: { days_of_week: [5], departure_local_time: "09:00", mode: "weekly", round_trip: true, turnaround_minutes: 90 },
      route_id: "route-1",
      status: "active",
      updated_at: "2026-06-07T08:00:00.000Z",
      validity: { starts_on: "2030-01-07" },
    },
  ];

  const result = replaceAircraftSchedule(snapshot, {
    aircraft_id: "aircraft-1",
    blocks: [{ day: 1, departure_local_time: "09:00", route_id: "route-1" }],
    round_trip: true,
    turnaround_minutes: 90,
  });

  expect(result.removedScheduleIds).toContain("schedule-old");
  expect(result.schedules[0]?.status).toBe("active");
  expect(result.previews[0]?.canActivate).toBe(true);
});

test("ferry flight builds a one-way leg from the aircraft position carrying passengers", () => {
  const snapshot = operationsSnapshot();
  const result = buildFerryFlight(snapshot, {
    aircraft_id: "aircraft-1",
    departure_date: "2026-06-10",
    departure_local_time: "09:00",
    destination_airport_id: "airport-2",
  });

  expect("flight" in result).toBe(true);
  if ("flight" in result) {
    expect(result.flight.origin_airport_id).toBe("airport-1");
    expect(result.flight.destination_airport_id).toBe("airport-2");
    expect(result.flight.expected.passengers).toBeGreaterThan(0);
    expect(result.flight.schedule_id.startsWith("ferry-")).toBe(true);
  }
});

test("ferry flight rejects a destination equal to the aircraft position", () => {
  const snapshot = operationsSnapshot();
  const result = buildFerryFlight(snapshot, {
    aircraft_id: "aircraft-1",
    departure_date: "2026-06-10",
    departure_local_time: "09:00",
    destination_airport_id: "airport-1",
  });

  expect("error" in result).toBe(true);
});

test("annotateOutOfPosition flags a flight that does not depart from the aircraft position", () => {
  const snapshot = operationsSnapshot();
  const flights: StoredFlight[] = [
    {
      aircraft_id: "aircraft-1",
      airline_id: "airline-1",
      arrival_at: "2026-06-20T11:00:00.000Z",
      created_at: "2026-06-07T08:00:00.000Z",
      departure_at: "2026-06-20T09:00:00.000Z",
      destination_airport_id: "airport-1",
      expected: { cost: 0, load_factor: 0.8, passengers: 100, profit: 0, revenue: 0 },
      flight_number: "AA20",
      id: "flight-misplaced",
      origin_airport_id: "airport-2",
      route_id: "route-1",
      schedule_id: "schedule-1",
      status: "scheduled",
      updated_at: "2026-06-07T08:00:00.000Z",
    },
  ];

  const [annotated] = annotateOutOfPosition(flights, snapshot.aircrafts, "airport-1");

  expect(annotated?.out_of_position).toBe(true);
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
