import { clamp, round2 } from "../import/shared/math";

export type DemandAffinity = {
  business?: number;
  diaspora?: number;
  tourism?: number;
};

export type DemandAirport = {
  fuel_price_multiplier?: number;
  gate_fee?: number;
  iata_code?: string;
  max_runway_length_m?: number;
  max_runway_uses_per_day?: number;
  runway_fee?: number;
  stand_fee?: number;
  works_at_night?: boolean;
};

export type DemandRegion = {
  business_score?: number;
  country_id?: string;
  gdp_per_capita?: number;
  population?: number;
  tourism_score?: number;
};

// Per-pair factor breakdown so the UI can explain *why* a demand number is what it
// is (and surface that the calibration constant K is a game knob, not a real value).
export type PassengerDemandBreakdown = {
  affinityFactor: number;
  airportFactor: number;
  baseDemand: number;
  business: number;
  calibrationK: number;
  destinationGdpPerCapita: number;
  destinationPopulation: number;
  diaspora: number;
  directionFactorDestinationToOrigin: number;
  directionFactorOriginToDestination: number;
  distanceImpedance: number;
  gdpElasticity: number;
  gravity: number;
  originGdpPerCapita: number;
  originPopulation: number;
  populationElasticity: number;
  sameCountry: boolean;
  tourism: number;
};

export type PassengerDemandResult = {
  business: number;
  destinationToOrigin: number;
  diaspora: number;
  originToDestination: number;
  tourism: number;
};

const CALIBRATION_K = 0.45;
const GDP_ELASTICITY = 0.6;
const POPULATION_ELASTICITY = 0.5;

export function calculatePassengerDemand(
  originAirport: DemandAirport,
  destinationAirport: DemandAirport,
  originRegion: DemandRegion,
  destinationRegion: DemandRegion,
  distanceKm: number,
  existing: DemandAffinity = {},
): PassengerDemandResult {
  return explainPassengerDemand(originAirport, destinationAirport, originRegion, destinationRegion, distanceKm, existing).result;
}

export function distanceImpedance(distanceKm: number): number {
  return 1 / (1 + Math.max(distanceKm, 50) / 1800) ** 1.25;
}

// Same computation as calculatePassengerDemand, but also returns the intermediate
// factors. calculatePassengerDemand delegates here so the two never drift apart.
export function explainPassengerDemand(
  originAirport: DemandAirport,
  destinationAirport: DemandAirport,
  originRegion: DemandRegion,
  destinationRegion: DemandRegion,
  distanceKm: number,
  existing: DemandAffinity = {},
): { breakdown: PassengerDemandBreakdown; result: PassengerDemandResult } {
  const sameCountry = Boolean(originRegion.country_id && originRegion.country_id === destinationRegion.country_id);
  const business = clamp(existing.business ?? regionalAffinity(originRegion.business_score, destinationRegion.business_score, distanceKm, sameCountry), 0, 1);
  const tourism = clamp(existing.tourism ?? regionalAffinity(originRegion.tourism_score, destinationRegion.tourism_score, distanceKm, sameCountry), 0, 1);
  const diaspora = clamp(existing.diaspora ?? diasporaAffinity(originRegion, destinationRegion, distanceKm, sameCountry), 0, 1);
  const impedance = distanceImpedance(distanceKm);
  const gravity = gravityDemand(originRegion, destinationRegion, distanceKm);
  const airportFactor = Math.sqrt(airportMarketFactor(originAirport) * airportMarketFactor(destinationAirport));
  const affinityFactor = 0.7 + 0.75 * business + 0.55 * tourism + 0.45 * diaspora + (sameCountry ? 0.22 : 0);
  const baseDemand = gravity * airportFactor * affinityFactor;
  const directionAb = directionFactor(originRegion, destinationRegion, business, tourism, diaspora);
  const directionBa = directionFactor(destinationRegion, originRegion, business, tourism, diaspora);

  return {
    breakdown: {
      affinityFactor: round2(affinityFactor),
      airportFactor: round2(airportFactor),
      baseDemand: round2(baseDemand),
      business: round2(business),
      calibrationK: CALIBRATION_K,
      destinationGdpPerCapita: Math.max(destinationRegion.gdp_per_capita ?? 10_000, 500),
      destinationPopulation: Math.max(destinationRegion.population ?? 100_000, 50_000),
      diaspora: round2(diaspora),
      directionFactorDestinationToOrigin: round2(directionBa),
      directionFactorOriginToDestination: round2(directionAb),
      distanceImpedance: round2(impedance),
      gdpElasticity: GDP_ELASTICITY,
      gravity: round2(gravity),
      originGdpPerCapita: Math.max(originRegion.gdp_per_capita ?? 10_000, 500),
      originPopulation: Math.max(originRegion.population ?? 100_000, 50_000),
      populationElasticity: POPULATION_ELASTICITY,
      sameCountry,
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

export function gravityDemand(left: DemandRegion, right: DemandRegion, distanceKm: number): number {
  const leftPopulationMillions = Math.max(left.population ?? 100_000, 50_000) / 1_000_000;
  const rightPopulationMillions = Math.max(right.population ?? 100_000, 50_000) / 1_000_000;
  const leftGdpThousands = Math.max(left.gdp_per_capita ?? 10_000, 500) / 1000;
  const rightGdpThousands = Math.max(right.gdp_per_capita ?? 10_000, 500) / 1000;
  const marketMass =
    leftPopulationMillions ** POPULATION_ELASTICITY *
    rightPopulationMillions ** POPULATION_ELASTICITY *
    leftGdpThousands ** GDP_ELASTICITY *
    rightGdpThousands ** GDP_ELASTICITY;

  return CALIBRATION_K * marketMass * distanceImpedance(distanceKm);
}

function airportMarketFactor(airport: DemandAirport): number {
  const runwayFactor = clamp((airport.max_runway_length_m ?? 1800) / 3500, 0.25, 1.35);
  const slotFactor = clamp(Math.sqrt(airport.max_runway_uses_per_day ?? 90) / Math.sqrt(650), 0.25, 1.35);
  const nightFactor = airport.works_at_night === false ? 0.82 : 1.08;
  const feeTotal = (airport.runway_fee ?? 0) + (airport.gate_fee ?? 0) + (airport.stand_fee ?? 0);
  const feeFactor = clamp(1.16 - feeTotal / 25_000, 0.72, 1.12);
  const fuelFactor = clamp(1.08 - ((airport.fuel_price_multiplier ?? 1) - 1) * 0.18, 0.84, 1.1);
  const codeFactor = airport.iata_code ? 1.08 : 0.86;

  return clamp(runwayFactor * slotFactor * nightFactor * feeFactor * fuelFactor * codeFactor, 0.12, 1.8);
}

function diasporaAffinity(left: DemandRegion, right: DemandRegion, distanceKm: number, sameCountry: boolean): number {
  const populationBalance = Math.sqrt(
    Math.max(1, Math.min(left.population ?? 1, right.population ?? 1)) /
      Math.max(1, Math.max(left.population ?? 1, right.population ?? 1)),
  );

  return (sameCountry ? 0.42 : 0.06) + 0.22 / (1 + distanceKm / 2200) + 0.32 * populationBalance;
}

function directionFactor(
  origin: DemandRegion,
  destination: DemandRegion,
  business: number,
  tourism: number,
  diaspora: number,
): number {
  const originWealth = Math.sqrt(Math.max(origin.gdp_per_capita ?? 10_000, 500) / 10_000);
  const destinationLeisure = 0.75 + 0.45 * (destination.tourism_score ?? 0.2);
  const businessPull = 0.82 + 0.28 * business + 0.12 * (destination.business_score ?? 0.2);
  const diasporaPull = 0.92 + 0.16 * diaspora;

  return clamp(originWealth * destinationLeisure * businessPull * diasporaPull, 0.45, 1.8) * (0.88 + 0.24 * tourism);
}

function regionalAffinity(
  leftScore: number | undefined,
  rightScore: number | undefined,
  distanceKm: number,
  sameCountry: boolean,
): number {
  const score = Math.sqrt(Math.max(leftScore ?? 0.15, 0.01) * Math.max(rightScore ?? 0.15, 0.01));

  return score * (0.42 + 0.58 / (1 + distanceKm / 5200)) * (sameCountry ? 1.16 : 1);
}
