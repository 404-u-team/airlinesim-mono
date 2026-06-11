import { type CalibrationArtifact, getCountryPropensity, loadCalibration } from "./calibration";
import { type DemandAffinity, explainPairDemand, type MarketEndpoint, type PassengerDemandBreakdown } from "./model";
import { getOverrideMultiplier, loadOverrides } from "./overrides";
import { airportPairStrengthFactor, getAirportProfile } from "./profiles";

// Unified demand service. Joins the pure model (Layers 1–3) with the data layers:
// catchment + metro market (Layer 0, from the import artifact), per-country
// propensity (Layer 2, from calibration), and per-pair overrides (Layer 4). It
// computes demand at the *market* (metro) level then splits it to the specific
// airport pair by capacity share. Demand is computed live and locally — no backend
// RegionLink. See docs/passenger-demand-model.md.

export type AirportPairDemand = {
  breakdown: DemandBreakdown;
  destinationDailyPassengers: number;
  originDailyPassengers: number;
};

export type DemandAirportInput = {
  iata_code?: string;
  icao_code?: string;
  id?: string;
  region_id?: string;
};

// Extends the model breakdown with the data-layer provenance the UI surfaces.
export type DemandBreakdown = PassengerDemandBreakdown & {
  airportStrengthFactor: number;
  capacityShareFactor: number;
  catchmentSource: "artifact" | "region-fallback";
  destinationCapacityShare: number;
  destinationMarketKey: string;
  originCapacityShare: number;
  originMarketKey: string;
  overrideMultiplier: number;
};

export type DemandRegionInput = {
  business_score?: number;
  country_id?: string;
  gdp_per_capita?: number;
  id?: string;
  population?: number;
  tourism_score?: number;
};

type ResolvedMarket = {
  capacityShare: number;
  endpoint: MarketEndpoint;
  marketKey: string;
  usesArtifact: boolean;
};

export function computeAirportPairDemand(
  originAirport: DemandAirportInput,
  destinationAirport: DemandAirportInput,
  originRegion: DemandRegionInput | undefined,
  destinationRegion: DemandRegionInput | undefined,
  distanceKm: number,
  affinity: DemandAffinity = {},
): AirportPairDemand {
  const calibration = loadCalibration();
  const overrides = loadOverrides();

  const origin = resolveMarket(originAirport, originRegion, calibration);
  const destination = resolveMarket(destinationAirport, destinationRegion, calibration);

  const { breakdown, result } = explainPairDemand(origin.endpoint, destination.endpoint, distanceKm, affinity, calibration.params);

  // Metro→airport split: an airport-pair captures the slice of the metro market
  // equal to the product of each end's capacity share. Summed over all member
  // pairs this returns the full metro market (shares each sum to 1).
  const capacityShareFactor = origin.capacityShare * destination.capacityShare;
  const strengthFactor = airportPairStrengthFactor(originAirport.icao_code, destinationAirport.icao_code);
  const overrideMultiplier = getOverrideMultiplier(origin.marketKey, destination.marketKey, overrides);
  const factor = capacityShareFactor * strengthFactor * overrideMultiplier;

  return {
    breakdown: {
      ...breakdown,
      airportStrengthFactor: round4(strengthFactor),
      capacityShareFactor: round4(capacityShareFactor),
      catchmentSource: origin.usesArtifact && destination.usesArtifact ? "artifact" : "region-fallback",
      destinationCapacityShare: round4(destination.capacityShare),
      destinationMarketKey: destination.marketKey,
      originCapacityShare: round4(origin.capacityShare),
      originMarketKey: origin.marketKey,
      overrideMultiplier: round4(overrideMultiplier),
    },
    destinationDailyPassengers: Math.max(0, Math.round(result.destinationToOrigin * factor)),
    originDailyPassengers: Math.max(0, Math.round(result.originToDestination * factor)),
  };
}

function fallbackMarketKey(airport: DemandAirportInput): string {
  return ([airport.iata_code, airport.icao_code, airport.id].find(Boolean) ?? "?").toUpperCase();
}

function resolveMarket(
  airport: DemandAirportInput,
  region: DemandRegionInput | undefined,
  calibration: CalibrationArtifact,
): ResolvedMarket {
  const profile = getAirportProfile(airport.icao_code);
  const marketCatchment = profile?.marketCatchmentPopulation ?? 0;
  const usesArtifact = marketCatchment > 0;
  const r = region ?? {};

  return {
    capacityShare: profile?.capacityShare ?? 1,
    endpoint: {
      businessScore: r.business_score,
      catchmentPopulation: usesArtifact ? marketCatchment : r.population ?? 0,
      countryId: r.country_id,
      gdpPerCapita: r.gdp_per_capita,
      propensity: getCountryPropensity(r.country_id, calibration),
      tourismScore: r.tourism_score,
    },
    marketKey: profile?.marketKey ?? fallbackMarketKey(airport),
    usesArtifact,
  };
}

function round4(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}
