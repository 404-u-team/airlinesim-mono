// Per-flight passenger load model (v2). See docs/flight-load-model.md.
//
// The demand model gives the market potential of a pair (one-way pax/day). This
// turns that into how many passengers board a *specific* flight, given fare,
// frequency and capacity:
//
//   weeklyMarket  = dailyDemand · 7
//   effective     = weeklyMarket · (fare / referenceFare)^(-ε)     fare elasticity
//   captured      = effective · (1 − e^(−f/f0))                    frequency S-curve
//   perFlight     = min(seats · maxLF, captured / flightsPerWeek)  spill cap, no floor
//
// No artificial load-factor floor: a thin market yields an honestly low load
// factor (a real signal that the route is weak). Competition/market-share is not
// modelled yet (monopoly capture) — see the doc for the QSI extension point.

// Price elasticity of demand (short-haul/leisure ≈ 1.1; IATA/InterVISTAS 0.8–1.5).
export const FARE_ELASTICITY = 1.1;
// Daily-equivalent frequency at which ~63% of the market is captured.
export const FREQUENCY_HALF_SATURATION = 0.7;
// Realistic upper bound on sustained load factor.
export const MAX_LOAD_FACTOR = 0.92;

// Share of the market captured at a given weekly frequency (monopoly S-curve).
// ~46% at 3/week, ~76% daily, ~94% at 2/day.
export function captureShare(flightsPerWeek: number): number {
  const dailyEquivalent = Math.max(0, flightsPerWeek) / 7;
  return 1 - Math.exp(-dailyEquivalent / FREQUENCY_HALF_SATURATION);
}

export function expectedPassengersPerFlight(args: {
  dailyDemand: number;
  distanceKm: number;
  fare: number;
  flightsPerWeek: number;
  seats: number;
}): number {
  const flights = Math.max(1, args.flightsPerWeek);
  const weeklyMarket = Math.max(0, args.dailyDemand) * 7;
  const fareRatio = args.fare > 0 ? args.fare / referenceFare(args.distanceKm) : 1;
  const effectiveMarket = weeklyMarket * fareRatio ** -FARE_ELASTICITY;
  const capturedWeek = effectiveMarket * captureShare(flights);
  const perFlight = Math.min(args.seats * MAX_LOAD_FACTOR, capturedWeek / flights);

  return Math.max(0, Math.round(perFlight));
}

// Typical "neutral" fare for a distance; fares above it suppress demand, below it
// lift it. Shared with route economics so the two never drift (fareRatio = 1 when
// the route charges the reference fare).
export function referenceFare(distanceKm: number): number {
  return Math.max(55, 38 + distanceKm * 0.12);
}
