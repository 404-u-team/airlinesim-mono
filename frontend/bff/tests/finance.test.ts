import { expect, test } from "bun:test";

import type { StoredFlight } from "../src/modules/operations/types";

import {
  buildFinanceRisks,
  buildFlightTransactions,
  sumLedger,
} from "../src/modules/finance/calculator";

test("creates a balanced operational ledger for a completed flight", () => {
  const transactions = buildFlightTransactions(flight());
  const repeated = buildFlightTransactions(flight());

  expect(transactions).toHaveLength(4);
  expect(transactions.map((item) => item.id)).toEqual(repeated.map((item) => item.id));
  expect(new Set(transactions.map((item) => item.idempotency_key)).size).toBe(4);
  expect(sumLedger(transactions)).toBe(4_000);
  expect(transactions.filter((item) => item.direction === "debit").reduce((sum, item) => sum + item.amount, 0)).toBe(6_000);
});

test("does not create transactions before flight completion", () => {
  expect(buildFlightTransactions(flight({ status: "in_flight" }))).toEqual([]);
});

test("surfaces the actionable MVP finance risks", () => {
  const risks = buildFinanceRisks(1_000_000, -50_000, true, [{ profit: -5_000, route_id: "route-1" }]);

  expect(risks.map((risk) => risk.code)).toEqual([
    "BANKRUPTCY_FLAG",
    "LOW_BALANCE",
    "WEEKLY_OPERATING_LOSS",
    "ROUTE_LOSS",
  ]);
  expect(risks.at(-1)?.target_path).toBe("/airports/routes?route_id=route-1");
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
    status: "completed",
    updated_at: "2026-06-04T12:00:00.000Z",
    ...overrides,
  };
}
