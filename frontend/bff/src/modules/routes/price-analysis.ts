import type { LedgerTransaction } from "../finance/types";
import type { AircraftType, Airport } from "../fleet/types";
import type { StoredRoute } from "./types";

import { estimateFlightFinancials, type FlightLeg } from "../operations/flights";
import { referenceFare } from "../operations/passenger-load";

// Flat fee charged for one optimal-price analysis (debited to the airline ledger).
export const PRICE_ANALYSIS_FEE = 50_000;

// Fare search grid, as multipliers of the distance-based reference fare.
const GRID_MIN = 0.4;
const GRID_MAX = 2;
const GRID_STEP = 0.05;

export type LegPriceAdvice = {
  // The auto/reference fare and the profit it would earn — the free baseline the paid
  // optimisation is compared against, so the player can see what the fee buys.
  auto_fare: number;
  auto_profit_per_flight: number;
  projected_load_factor: number;
  projected_passengers: number;
  projected_profit_per_flight: number;
  suggested_fare: number;
  // Extra profit per flight the suggested fare earns over the auto fare (can be 0).
  uplift_per_flight: number;
};

export type RoutePriceAnalysis = {
  currency: "USD";
  fee: number;
  flights_per_week: number;
  outbound: LegPriceAdvice;
  return: LegPriceAdvice;
};

export function analyzeRoutePrice(
  route: StoredRoute,
  type: AircraftType,
  origin: Airport,
  destination: Airport,
): RoutePriceAnalysis {
  const daysPerWeek = Math.max(1, route.base_frequency_per_week || 3);

  return {
    currency: "USD",
    fee: PRICE_ANALYSIS_FEE,
    flights_per_week: daysPerWeek,
    // Return-leg economics fly destination → origin; demand is selected by `leg`.
    outbound: adviseLeg(route, type, origin, destination, daysPerWeek, "outbound"),
    return: adviseLeg(route, type, destination, origin, daysPerWeek, "return"),
  };
}

// A flat debit charged for one analysis. Unique idempotency key per call so every
// paid analysis is recorded (never deduped away).
export function priceAnalysisFeeTransaction(airlineId: string, routeId: string): LedgerTransaction {
  const now = new Date().toISOString();

  return {
    airline_id: airlineId,
    amount: PRICE_ANALYSIS_FEE,
    category: "system",
    created_at: now,
    currency: "USD",
    direction: "debit",
    id: `ledger-${crypto.randomUUID()}`,
    idempotency_key: `price-analysis:${routeId}:${crypto.randomUUID()}`,
    label_code: "FINANCE_PRICE_ANALYSIS_FEE",
    occurred_at: now,
    route_id: routeId,
    source_id: routeId,
    source_type: "system_adjustment",
  };
}

function adviseLeg(
  route: StoredRoute,
  type: AircraftType,
  origin: Airport,
  destination: Airport,
  daysPerWeek: number,
  leg: FlightLeg,
): LegPriceAdvice {
  // The paid analysis now returns the true profit-maximising fare (no artificial
  // noise): the fee buys an exact answer, and its value is the uplift over the free
  // auto/reference fare shown alongside it.
  const autoFare = referenceFare(route.demand_snapshot.distance_km);
  const suggestedFare = Math.max(1, findOptimalFare(route, type, origin, destination, daysPerWeek, leg));
  const projected = financialsAtFare(route, type, origin, destination, daysPerWeek, leg, suggestedFare);
  const auto = financialsAtFare(route, type, origin, destination, daysPerWeek, leg, autoFare);

  return {
    auto_fare: Math.round(autoFare),
    auto_profit_per_flight: auto.profit,
    projected_load_factor: projected.load_factor,
    projected_passengers: projected.passengers,
    projected_profit_per_flight: projected.profit,
    suggested_fare: Math.round(suggestedFare),
    uplift_per_flight: Math.max(0, projected.profit - auto.profit),
  };
}

function financialsAtFare(
  route: StoredRoute,
  type: AircraftType,
  origin: Airport,
  destination: Airport,
  daysPerWeek: number,
  leg: FlightLeg,
  fare: number,
): ReturnType<typeof estimateFlightFinancials> {
  const probe: StoredRoute = leg === "return"
    ? { ...route, fare_override_return: fare }
    : { ...route, fare_override_outbound: fare };

  return estimateFlightFinancials(probe, type, origin, destination, daysPerWeek, leg);
}

// Grid search for the profit-maximising fare. Kept internal: the player never sees it.
function findOptimalFare(
  route: StoredRoute,
  type: AircraftType,
  origin: Airport,
  destination: Airport,
  daysPerWeek: number,
  leg: FlightLeg,
): number {
  const reference = referenceFare(route.demand_snapshot.distance_km);
  let bestFare = reference;
  let bestProfit = Number.NEGATIVE_INFINITY;

  for (let multiplier = GRID_MIN; multiplier <= GRID_MAX + 1e-9; multiplier += GRID_STEP) {
    const fare = reference * multiplier;
    const { profit } = financialsAtFare(route, type, origin, destination, daysPerWeek, leg, fare);
    if (profit > bestProfit) {
      bestProfit = profit;
      bestFare = fare;
    }
  }

  return bestFare;
}
