import type { Airport, OnboardingAirportOption } from "./types";

export function calculateAirportScore(airport: Airport): OnboardingAirportOption {
  const warnings: string[] = [];
  let score = 100;

  if (airport.iata_code && airport.iata_code.trim().length > 0) {
    score += 1000;
  }

  score += getRunwayScoreAndWarning(airport.max_runway_length_m ?? 0, warnings);
  score += getNightScoreAndWarning(airport.works_at_night, warnings);
  score += getSlotsScoreAndWarning(airport.max_runway_uses_per_day ?? 0, warnings);
  score += getFeesScoreAndWarning(airport.gate_fee ?? 0, airport.stand_fee ?? 0, airport.runway_fee ?? 0, warnings);

  if (!airport.region_id || !airport.country_id) {
    score -= 200;
    warnings.push("MISSING_REGION_DATA");
  }

  return {
    country_id: airport.country_id,
    fuel_price_multiplier: airport.fuel_price_multiplier,
    gate_fee: airport.gate_fee,
    iata_code: airport.iata_code,
    icao_code: airport.icao_code,
    id: airport.id,
    intl_name: airport.intl_name,
    local_name: airport.local_name,
    max_runway_length_m: airport.max_runway_length_m,
    max_runway_uses_per_day: airport.max_runway_uses_per_day,
    municipality: airport.municipality,
    region_id: airport.region_id,
    runway_fee: airport.runway_fee,
    score,
    stand_fee: airport.stand_fee,
    warnings,
    works_at_night: airport.works_at_night,
  };
}

function getFeesScoreAndWarning(gate: number, stand: number, runway: number, warnings: string[]): number {
  const total = gate + stand + runway;
  if (total > 1000) {
    warnings.push("HIGH_FEES");
  }

  if (total > 1500) {
    return -150;
  }
  if (total > 1000) {
    return -100;
  }
  if (total > 500) {
    return -50;
  }
  return 0;
}

function getNightScoreAndWarning(worksAtNight: boolean | undefined, warnings: string[]): number {
  if (worksAtNight === true) {
    return 100;
  }
  warnings.push("NO_NIGHT_OPS");
  return -50;
}

function getRunwayScoreAndWarning(runway: number, warnings: string[]): number {
  if (runway < 1800) {
    warnings.push("SHORT_RUNWAY");
  }

  if (runway >= 2600) {
    return 300;
  }
  if (runway >= 2200) {
    return 200;
  }
  if (runway >= 1800) {
    return 100;
  }
  if (runway < 1500) {
    return -100;
  }
  return 0;
}

function getSlotsScoreAndWarning(slots: number, warnings: string[]): number {
  if (slots < 50) {
    warnings.push("LOW_SLOT_CAPACITY");
  }

  if (slots >= 200) {
    return 150;
  }
  if (slots >= 100) {
    return 100;
  }
  if (slots >= 50) {
    return 50;
  }
  return -100;
}
