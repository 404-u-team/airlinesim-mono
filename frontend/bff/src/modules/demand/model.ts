import { clamp, round2 } from "../import/shared/math";

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

export type DemandAffinity = {
  business?: number;
  diaspora?: number;
  tourism?: number;
};

export type MarketEndpoint = {
  businessScore?: number;
  catchmentPopulation: number;
  countryId?: string;
  gdpPerCapita?: number;
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

export const DEFAULT_CALIBRATION: CalibrationParams = {
  affinityBase: 0.7,
  affinityBusiness: 0.75,
  affinityDiaspora: 0.45,
  affinityTourism: 0.55,
  baseScale: 1.8,
  distanceD0: 2500,
  distanceP: 1.0,
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

export function groundCompetitionFactor(distanceKm: number, sameCountry: boolean): number {
  if (sameCountry) {
    return rampedShare(distanceKm, 350, 1100, 0.3);
  }
  return rampedShare(distanceKm, 200, 700, 0.6);
}

export function shortHaulFactor(distanceKm: number): number {
  return clamp((distanceKm - 60) / 240, 0, 1);
}

function catchmentOf(endpoint: MarketEndpoint): number {
  return Math.max(endpoint.catchmentPopulation || 0, MIN_CATCHMENT);
}

function diasporaAffinity(origin: MarketEndpoint, destination: MarketEndpoint, distanceKm: number, sameCountry: boolean): number {
  const a = Math.max(1, catchmentOf(origin));
  const b = Math.max(1, catchmentOf(destination));
  const populationBalance = Math.sqrt(Math.min(a, b) / Math.max(a, b));

  return (sameCountry ? 0.42 : 0.06) + 0.22 / (1 + distanceKm / 2200) + 0.32 * populationBalance;
}
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
