import { expect, test } from "bun:test";

import type { StoredFlight } from "../src/modules/operations/types";

import {
  computeActualFinancials,
  hasDeparted,
  settleDepartedFlights,
} from "../src/modules/operations/settlement";

test("hasDeparted is true once past departure and false for the future or cancelled", () => {
  const past = new Date(Date.now() - 60_000).toISOString();
  const future = new Date(Date.now() + 60_000).toISOString();

  expect(hasDeparted(flight({ departure_at: past }))).toBe(true);
  expect(hasDeparted(flight({ departure_at: future }))).toBe(false);
  expect(hasDeparted(flight({ departure_at: past, status: "cancelled" }))).toBe(false);
});

test("actual passengers are within ±10% of expected and revenue tracks the same fare", () => {
  const actual = computeActualFinancials(flight());

  expect(actual.passengers).toBeGreaterThanOrEqual(Math.round(120 * 0.9));
  expect(actual.passengers).toBeLessThanOrEqual(Math.round(120 * 1.1));
  // Fare is preserved: revenue per passenger stays at the expected 10000/120.
  expect(actual.revenue).toBe(Math.round((10_000 / 120) * actual.passengers));
  expect(actual.cost).toBe(6_000);
  expect(actual.profit).toBe(actual.revenue - 6_000);
});

test("settlement is deterministic by flight id", () => {
  const once = computeActualFinancials(flight());
  const twice = computeActualFinancials(flight());

  expect(once).toEqual(twice);
});

test("settleDepartedFlights stamps actual only on departed flights without one", () => {
  const past = new Date(Date.now() - 60_000).toISOString();
  const future = new Date(Date.now() + 60_000).toISOString();
  const settled = settleDepartedFlights([
    flight({ departure_at: past, id: "departed" }),
    flight({ departure_at: future, id: "upcoming" }),
  ]);

  expect(settled.find((item) => item.id === "departed")?.actual).toBeDefined();
  expect(settled.find((item) => item.id === "upcoming")?.actual).toBeUndefined();
});

function flight(overrides: Partial<StoredFlight> = {}): StoredFlight {
  return {
    aircraft_id: "aircraft-1",
    airline_id: "airline-1",
    arrival_at: "2026-06-04T12:00:00.000Z",
    created_at: "2026-06-04T08:00:00.000Z",
    departure_at: "2026-06-04T10:00:00.000Z",
    destination_airport_id: "airport-2",
    expected: {
      cost: 6_000,
      load_factor: 0.8,
      passengers: 120,
      profit: 4_000,
      revenue: 10_000,
    },
    flight_number: "AS101",
    id: "flight-1",
    origin_airport_id: "airport-1",
    route_id: "route-1",
    schedule_id: "schedule-1",
    status: "in_flight",
    updated_at: "2026-06-04T12:00:00.000Z",
    ...overrides,
  };
}
