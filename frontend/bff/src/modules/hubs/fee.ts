export type HubFeeAirport = {
  gate_fee?: number;
  max_runway_length_m?: number;
  max_runway_uses_per_day?: number;
  runway_fee?: number;
  stand_fee?: number;
};

export type HubFeeRegion = {
  business_score?: number;
  gdp_per_capita?: number;
  population?: number;
  tourism_score?: number;
};

const MIN_FEE = 200_000;
const MAX_FEE = 5_000_000;

/**
 * Establishment fee for a new hub, derived from imported airport + region metrics:
 * busier/larger airports in wealthier, more active regions cost more.
 */
export function estimateHubFee(airport: HubFeeAirport, region: HubFeeRegion | undefined): number {
  const raw = 150_000 + airportWeight(airport) + regionWeight(region);

  return Math.round(Math.max(MIN_FEE, Math.min(MAX_FEE, raw)));
}

function airportWeight(airport: HubFeeAirport): number {
  const fees = (airport.gate_fee ?? 0) + (airport.stand_fee ?? 0) + (airport.runway_fee ?? 0);

  return fees * 250 + (airport.max_runway_uses_per_day ?? 0) * 700 + (airport.max_runway_length_m ?? 0) * 40;
}

function regionWeight(region: HubFeeRegion | undefined): number {
  const activity = (region?.business_score ?? 0) + (region?.tourism_score ?? 0);

  return (region?.population ?? 0) / 40 + (region?.gdp_per_capita ?? 0) * 2.5 + activity * 1_500;
}
