import { expect, test } from "bun:test";

import type { AircraftType, Airport } from "../src/modules/fleet/types";
import type { StoredRoute } from "../src/modules/routes/types";

import { estimateFlightFinancials } from "../src/modules/operations/flights";
import { referenceFare } from "../src/modules/operations/passenger-load";
import {
  analyzeRoutePrice,
  PRICE_ANALYSIS_FEE,
  priceAnalysisFeeTransaction,
} from "../src/modules/routes/price-analysis";

test("analysis returns the exact profit-maximising grid optimum (no noise)", () => {
  const route = storedRoute();
  const optimal = bruteForceOptimum(route, "outbound");
  const analysis = analyzeRoutePrice(route, type(), airport(), airport());

  // The paid analysis is now exact: the suggested fare is the grid optimum (±1 rounding).
  expect(Math.abs(analysis.outbound.suggested_fare - optimal)).toBeLessThanOrEqual(1);
  expect(analysis.fee).toBe(PRICE_ANALYSIS_FEE);
});

test("the suggested fare never earns less than the auto fare (uplift ≥ 0)", () => {
  const analysis = analyzeRoutePrice(storedRoute(), type(), airport(), airport());

  expect(analysis.outbound.projected_profit_per_flight).toBeGreaterThanOrEqual(analysis.outbound.auto_profit_per_flight);
  expect(analysis.outbound.uplift_per_flight).toBeGreaterThanOrEqual(0);
  expect(analysis.outbound.auto_fare).toBe(Math.round(referenceFare(1200)));
});

test("projected profit matches the financials at the suggested fare", () => {
  const route = storedRoute();
  const analysis = analyzeRoutePrice(route, type(), airport(), airport());
  const atSuggested = estimateFlightFinancials(
    { ...route, fare_override_outbound: analysis.outbound.suggested_fare },
    type(),
    airport(),
    airport(),
    analysis.flights_per_week,
    "outbound",
  );

  expect(Math.abs(analysis.outbound.projected_profit_per_flight - atSuggested.profit)).toBeLessThanOrEqual(
    Math.max(50, Math.abs(atSuggested.profit) * 0.02),
  );
});

test("the fee transaction is a system debit with a unique idempotency key", () => {
  const first = priceAnalysisFeeTransaction("airline-1", "route-1");
  const second = priceAnalysisFeeTransaction("airline-1", "route-1");

  expect(first.amount).toBe(PRICE_ANALYSIS_FEE);
  expect(first.direction).toBe("debit");
  expect(first.category).toBe("system");
  expect(first.source_type).toBe("system_adjustment");
  expect(first.idempotency_key).not.toBe(second.idempotency_key);
});

function airport(): Airport {
  return { gate_fee: 100, runway_fee: 200, stand_fee: 50 } as Airport;
}

function bruteForceOptimum(route: StoredRoute, leg: "outbound" | "return"): number {
  const reference = referenceFare(route.demand_snapshot.distance_km);
  let bestFare = reference;
  let bestProfit = Number.NEGATIVE_INFINITY;

  for (let multiplier = 0.4; multiplier <= 2 + 1e-9; multiplier += 0.05) {
    const fare = reference * multiplier;
    const { profit } = estimateFlightFinancials(
      { ...route, fare_override_outbound: fare, fare_override_return: fare },
      type(),
      airport(),
      airport(),
      Math.max(1, route.base_frequency_per_week),
      leg,
    );
    if (profit > bestProfit) {
      bestProfit = profit;
      bestFare = fare;
    }
  }

  return bestFare;
}

function storedRoute(): StoredRoute {
  return {
    airline_id: "airline-1",
    base_frequency_per_week: 7,
    constraints_snapshot: [],
    created_at: new Date().toISOString(),
    demand_snapshot: {
      calculated_at: new Date().toISOString(),
      destination_daily_passengers: 200,
      distance_km: 1200,
      origin_daily_passengers: 200,
    },
    destination_airport_id: "airport-2",
    economics_snapshot: {
      confidence: "medium",
      estimated_cost_per_flight: 0,
      estimated_fare_per_passenger: Math.round(referenceFare(1200)),
      estimated_profit_per_flight: 0,
      estimated_revenue_per_flight: 0,
      expected_load_factor: 0,
    },
    id: "route-1",
    origin_airport_id: "airport-1",
    status: "awaiting_schedule",
    updated_at: new Date().toISOString(),
    warnings_snapshot: [],
  };
}

function type(): AircraftType {
  return {
    cruising_speed_kph: 800,
    fuel_consumption_per_hour: 2400,
    maint_cost_per_flight_hour: 600,
    max_planned_seat_capacity: 180,
  } as AircraftType;
}
