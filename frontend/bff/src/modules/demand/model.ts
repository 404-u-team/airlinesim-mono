import { clamp, round2 } from "../import/shared/math";

// ─────────────────────────────────────────────────────────────────────────────
// Passenger demand model v2 (layered). See docs/passenger-demand-model.md.
//
//   Layer 1  Gravity      shape: catchment^α · GDPpc^β · D(distance)
//   Layer 2  Propensity   level: per-country aviation-propensity multiplier
//   Layer 3  Affinity     business / tourism / diaspora
//   Layer 4  Override     surgical per-pair multiplier (applied by the caller)
//
// This module is a pure function of its inputs. Catchment population and the
// per-country propensity come from upstream (import artifact + calibration); the
// caller supplies them. The metro→airport capacity split is applied by the caller
// (route layer), not here — this computes the *market* (metro-pair) demand.
// ─────────────────────────────────────────────────────────────────────────────

export type CalibrationParams = {
  affinityBase: number;
  affinityBusiness: number;
  affinityDiaspora: number;
  affinityTourism: number;
  baseScale: number;
  distanceD0: number;
  distanceP: number;
  gdpElasticity: number;
  populationElasticity: number;
};

// Optional precomputed affinity (0..1). If omitted, synthesized from scores.
export type DemandAffinity = {
  business?: number;
  diaspora?: number;
  tourism?: number;
};

// One end of a market pair (a metro market, or a single-airport market).
export type MarketEndpoint = {
  businessScore?: number;
  // Population this market can draw on (metro catchment), in people.
  catchmentPopulation: number;
  countryId?: string;
  gdpPerCapita?: number;
  // Aviation-propensity multiplier for this market's country (1 = neutral).
  propensity?: number;
  tourismScore?: number;
};

export type PassengerDemandBreakdown = {
  affinityFactor: number;
  baseDemand: number;
  baseScale: number;
  business: number;
  destinationCatchment: number;
  destinationGdpPerCapita: number;
  destinationPropensity: number;
  diaspora: number;
  directionFactorDestinationToOrigin: number;
  directionFactorOriginToDestination: number;
  distanceImpedance: number;
  gdpElasticity: number;
  gravity: number;
  groundCompetition: number;
  originCatchment: number;
  originGdpPerCapita: number;
  originPropensity: number;
  populationElasticity: number;
  propensityFactor: number;
  sameCountry: boolean;
  shortHaulFactor: number;
  tourism: number;
};

export type PassengerDemandResult = {
  business: number;
  destinationToOrigin: number;
  diaspora: number;
  originToDestination: number;
  tourism: number;
};

// Defaults are sane starting points; the calibration layer (Phase 3) fits and
// overrides these against real Eurostat/BTS anchors. baseScale replaces the old
// global K. Propensity defaults to 1 per country until calibration fills it in.
export const DEFAULT_CALIBRATION: CalibrationParams = {
  affinityBase: 0.7,
  affinityBusiness: 0.75,
  affinityDiaspora: 0.45,
  affinityTourism: 0.55,
  baseScale: 1.8,
  distanceD0: 1800,
  distanceP: 1.25,
  gdpElasticity: 0.55,
  populationElasticity: 0.62,
};

const MIN_CATCHMENT = 5_000;
const MIN_GDP = 500;

export function calculatePairDemand(
  origin: MarketEndpoint,
  destination: MarketEndpoint,
  distanceKm: number,
  affinity: DemandAffinity = {},
  calibration: CalibrationParams = DEFAULT_CALIBRATION,
): PassengerDemandResult {
  return explainPairDemand(origin, destination, distanceKm, affinity, calibration).result;
}

export function distanceImpedance(distanceKm: number, calibration: CalibrationParams = DEFAULT_CALIBRATION): number {
  return 1 / (1 + Math.max(distanceKm, 50) / calibration.distanceD0) ** calibration.distanceP;
}

export function explainPairDemand(
  origin: MarketEndpoint,
  destination: MarketEndpoint,
  distanceKm: number,
  affinity: DemandAffinity = {},
  calibration: CalibrationParams = DEFAULT_CALIBRATION,
): { breakdown: PassengerDemandBreakdown; result: PassengerDemandResult } {
  const sameCountry = Boolean(origin.countryId && origin.countryId === destination.countryId);

  const business = clamp(affinity.business ?? regionalAffinity(origin.businessScore, destination.businessScore, distanceKm, sameCountry), 0, 1);
  const tourism = clamp(affinity.tourism ?? regionalAffinity(origin.tourismScore, destination.tourismScore, distanceKm, sameCountry), 0, 1);
  const diaspora = clamp(affinity.diaspora ?? diasporaAffinity(origin, destination, distanceKm, sameCountry), 0, 1);

  const impedance = distanceImpedance(distanceKm, calibration);
  const gravity = gravityMass(origin, destination, calibration) * impedance;

  const originPropensity = clamp(origin.propensity ?? 1, 0.25, 4);
  const destinationPropensity = clamp(destination.propensity ?? 1, 0.25, 4);
  const propensityFactor = Math.sqrt(originPropensity * destinationPropensity);

  const affinityFactor =
    calibration.affinityBase +
    calibration.affinityBusiness * business +
    calibration.affinityTourism * tourism +
    calibration.affinityDiaspora * diaspora;

  const shortHaul = shortHaulFactor(distanceKm);
  const groundCompetition = groundCompetitionFactor(distanceKm, sameCountry);
  const baseDemand = calibration.baseScale * gravity * propensityFactor * affinityFactor * shortHaul * groundCompetition;

  const directionAb = directionFactor(origin, destination, business, tourism, diaspora);
  const directionBa = directionFactor(destination, origin, business, tourism, diaspora);

  return {
    breakdown: {
      affinityFactor: round2(affinityFactor),
      baseDemand: round2(baseDemand),
      baseScale: calibration.baseScale,
      business: round2(business),
      destinationCatchment: catchmentOf(destination),
      destinationGdpPerCapita: gdpOf(destination),
      destinationPropensity: round2(destinationPropensity),
      diaspora: round2(diaspora),
      directionFactorDestinationToOrigin: round2(directionBa),
      directionFactorOriginToDestination: round2(directionAb),
      distanceImpedance: round2(impedance),
      gdpElasticity: calibration.gdpElasticity,
      gravity: round2(gravity),
      groundCompetition: round2(groundCompetition),
      originCatchment: catchmentOf(origin),
      originGdpPerCapita: gdpOf(origin),
      originPropensity: round2(originPropensity),
      populationElasticity: calibration.populationElasticity,
      propensityFactor: round2(propensityFactor),
      sameCountry,
      shortHaulFactor: round2(shortHaul),
      tourism: round2(tourism),
    },
    result: {
      business: round2(business),
      destinationToOrigin: Math.max(1, round2(baseDemand * directionBa)),
      diaspora: round2(diaspora),
      originToDestination: Math.max(1, round2(baseDemand * directionAb)),
      tourism: round2(tourism),
    },
  };
}

// Catchment-based gravity mass (no distance term — that is applied separately).
export function gravityMass(origin: MarketEndpoint, destination: MarketEndpoint, calibration: CalibrationParams = DEFAULT_CALIBRATION): number {
  const originPopMln = catchmentOf(origin) / 1_000_000;
  const destinationPopMln = catchmentOf(destination) / 1_000_000;
  const originGdpK = gdpOf(origin) / 1000;
  const destinationGdpK = gdpOf(destination) / 1000;

  return (
    originPopMln ** calibration.populationElasticity *
    destinationPopMln ** calibration.populationElasticity *
    originGdpK ** calibration.gdpElasticity *
    destinationGdpK ** calibration.gdpElasticity
  );
}

// Short/medium hauls lose share to the ground (rail/road) and to substitute
// airports. Same-country pairs are hit hardest — nobody flies Berlin–Cologne when
// the train is competitive — with air share low under ~350 km and recovering by
// ~1100 km, beyond which flying wins again (Moscow–Vladivostok, US transcon).
// Cross-border pairs face a *milder* version of the same effect: short international
// hops (Brussels–Amsterdam, Aachen–Liège catchments) also bleed to trains and to
// adjacent airports, just less severely than domestic ones. Busy corridors that beat
// this average (fast-rail-free routes) can be lifted via an override.
export function groundCompetitionFactor(distanceKm: number, sameCountry: boolean): number {
  if (sameCountry) {
    return rampedShare(distanceKm, 350, 1100, 0.3);
  }
  // Cross-border: weaker competition, only bites the genuinely short hops.
  return rampedShare(distanceKm, 200, 700, 0.6);
}

// Collapses demand for intra-metro / very short pairs (~40 km, a city's two
// airports) where nobody flies. Ramps 0 → 1 between 60 and 300 km.
export function shortHaulFactor(distanceKm: number): number {
  return clamp((distanceKm - 60) / 240, 0, 1);
}

function catchmentOf(endpoint: MarketEndpoint): number {
  return Math.max(endpoint.catchmentPopulation || 0, MIN_CATCHMENT);
}

// Fallback diaspora affinity when no real migrant-corridor data is supplied. The
// data-driven version (Layer 3) overrides this via the `affinity.diaspora` input.
function diasporaAffinity(origin: MarketEndpoint, destination: MarketEndpoint, distanceKm: number, sameCountry: boolean): number {
  const a = Math.max(1, catchmentOf(origin));
  const b = Math.max(1, catchmentOf(destination));
  const populationBalance = Math.sqrt(Math.min(a, b) / Math.max(a, b));

  return (sameCountry ? 0.42 : 0.06) + 0.22 / (1 + distanceKm / 2200) + 0.32 * populationBalance;
}

// Directional skew centred on 1.0: the two directions of a pair average ~1× the
// (symmetric) base demand, with a mild lean toward the wealthier origin and more
// leisure-attractive destination. It must NOT roughly double one-way demand — that
// was a v2.0 bug. Range ~0.75–1.3, so AB and BA together ≈ 2× base.
function directionFactor(origin: MarketEndpoint, destination: MarketEndpoint, business: number, tourism: number, diaspora: number): number {
  void business;
  const wealthLean = (gdpOf(origin) / gdpOf(destination)) ** 0.1;
  const leisurePull = 0.95 + 0.12 * (destination.tourismScore ?? 0.3);
  const diasporaPull = 0.97 + 0.06 * diaspora;

  return clamp(wealthLean * leisurePull * diasporaPull * (0.97 + 0.06 * tourism), 0.75, 1.3);
}

function gdpOf(endpoint: MarketEndpoint): number {
  return Math.max(endpoint.gdpPerCapita ?? 10_000, MIN_GDP);
}

// Air's share of a pair: `floor` at/below `low`, recovering linearly to 1 at `high`.
function rampedShare(distanceKm: number, low: number, high: number, floor: number): number {
  if (distanceKm >= high) {
    return 1;
  }
  if (distanceKm <= low) {
    return floor;
  }
  return floor + (1 - floor) * ((distanceKm - low) / (high - low));
}

function regionalAffinity(leftScore: number | undefined, rightScore: number | undefined, distanceKm: number, sameCountry: boolean): number {
  const score = Math.sqrt(Math.max(leftScore ?? 0.15, 0.01) * Math.max(rightScore ?? 0.15, 0.01));

  return score * (0.42 + 0.58 / (1 + distanceKm / 5200)) * (sameCountry ? 1.16 : 1);
}
