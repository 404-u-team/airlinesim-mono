// Per-flight settlement: the financial result is realised at *departure*, not arrival.
// Passenger count is the expected load with a deterministic ±10% noise (seeded by the
// flight id), so repeated settlement on every snapshot load yields the same numbers —
// no persisted `actual` needed and no drift across reads.

import type { FlightFinancials, StoredFlight } from "./types";

import { MAX_LOAD_FACTOR } from "./passenger-load";

// Magnitude of the symmetric passenger noise applied at departure (±10%).
const PASSENGER_NOISE = 0.1;

// Freezes the realised result of a departed flight from its expected estimate.
export function computeActualFinancials(flight: StoredFlight): FlightFinancials {
  const { expected } = flight;
  const fare = expected.passengers > 0 ? expected.revenue / expected.passengers : 0;
  const passengers = Math.max(0, Math.round(expected.passengers * (1 + seededNoise(flight.id, PASSENGER_NOISE))));
  const revenue = Math.round(fare * passengers);
  const loadFactor = expected.passengers > 0
    ? clamp((expected.load_factor * passengers) / expected.passengers, 0, MAX_LOAD_FACTOR)
    : expected.load_factor;

  return {
    cost: expected.cost,
    load_factor: Number(loadFactor.toFixed(2)),
    passengers,
    profit: revenue - expected.cost,
    revenue,
  };
}

// True once the flight has pushed back (used to gate revenue/cost recognition).
export function hasDeparted(flight: StoredFlight, now = new Date()): boolean {
  return flight.status !== "cancelled" && new Date(flight.departure_at).getTime() <= now.getTime();
}

// Stamps `actual` on every departed flight that does not have one yet. Idempotent.
export function settleDepartedFlights(flights: StoredFlight[], now = new Date()): StoredFlight[] {
  return flights.map((flight) =>
    !flight.actual && hasDeparted(flight, now)
      ? { ...flight, actual: computeActualFinancials(flight) }
      : flight);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function hashCode(value: string): number {
  return value.split("").reduce((hash, char) => (hash << 5) - hash + char.charCodeAt(0), 0);
}

// Deterministic noise in [-magnitude, magnitude) derived from a seed string.
function seededNoise(seed: string, magnitude: number): number {
  const unit = (Math.abs(hashCode(seed)) % 1000) / 1000;

  return (unit * 2 - 1) * magnitude;
}
