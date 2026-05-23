import type { GeoCity, RestCountry } from "../runtime/sources";
import type { AirportType, FinalAirport, FinalCountry, FinalRegion, Point } from "../shared/types";
import type { RunwayInfo } from "./types";

import { clamp, distanceKm } from "../shared/math";

export function airportCapacityIndex(
  type: AirportType,
  runway: RunwayInfo,
  scheduled: boolean,
  hasIata: boolean,
): number {
  const baseByType: Record<AirportType, number> = {
    large_airport: 1,
    medium_airport: 0.45,
    small_airport: 0.12,
  };
  const runwayFactor = clamp(runway.maxLengthM / 3500, 0.2, 1.35);
  const runwayCountFactor = clamp(0.75 + 0.18 * Math.sqrt(Math.max(runway.count, 1)), 0.8, 1.35);
  const nightFactor = runway.worksAtNight ? 1.15 : 0.75;
  const scheduledFactor = scheduled ? 1 : 0.35;
  const iataBonus = hasIata ? 1.05 : 1;

  return clamp(baseByType[type] * runwayFactor * runwayCountFactor * nightFactor * scheduledFactor * iataBonus, 0.03, 1.8);
}

export function airportWeight(type: AirportType): number {
  const weightByType: Record<AirportType, number> = {
    large_airport: 4,
    medium_airport: 1.5,
    small_airport: 0.3,
  };

  return weightByType[type];
}

export function clean(value: null | string | undefined): string {
  return (value ?? "").trim();
}

export function continentFromRest(rest?: RestCountry): string {
  const continentByRegion: Record<string, string> = {
    Africa: "AF",
    Americas: "NA",
    Asia: "AS",
    Europe: "EU",
    Oceania: "OC",
  };

  return continentByRegion[rest?.region ?? ""] ?? "";
}

export function fallbackCorpTax(incomeLevel: null | string): number {
  const taxByIncome: Record<string, number> = {
    HIC: 22,
    LIC: 15,
    LMC: 18,
    UMC: 20,
  };

  return taxByIncome[incomeLevel ?? ""] ?? 20;
}

export function fallbackGdp(incomeLevel: null | string): number {
  const gdpByIncome: Record<string, number> = {
    HIC: 45000,
    LIC: 1000,
    LMC: 4000,
    UMC: 12000,
  };

  return gdpByIncome[incomeLevel ?? ""] ?? 10000;
}

export function fallbackTourism(country: FinalCountry): number {
  const rates: Record<string, number> = { AF: 0.08, AS: 0.16, EU: 0.35, NA: 0.2, OC: 0.18, SA: 0.12 };

  return (country.population ?? 1_000_000) * (rates[country.continent] ?? 0.1);
}

export function fallbackVat(incomeLevel: null | string, continent: string): number {
  const incomeVatByLevel: Record<string, number> = {
    HIC: 18,
    LIC: 10,
    LMC: 12,
    UMC: 15,
  };
  const continentVat: Record<string, number> = { AF: 15, AN: 0, AS: 12, EU: 20, NA: 8, OC: 10, SA: 16 };

  return incomeVatByLevel[incomeLevel ?? ""] ?? continentVat[continent] ?? 15;
}

export function groupBy<TValue>(values: TValue[], getKey: (value: TValue) => string): Map<string, TValue[]> {
  const result = new Map<string, TValue[]>();

  for (const value of values) {
    const key = getKey(value);
    result.set(key, [...(result.get(key) ?? []), value]);
  }

  return result;
}

export function linkScore(link: FinalRegion | { values: { business: number; diaspora: number; tourism: number } }): number {
  if ("values" in link) {
    return 0.4 * link.values.business + 0.35 * link.values.tourism + 0.25 * link.values.diaspora;
  }

  return link.payload.business_score + link.payload.tourism_score;
}

export function localCountryName(rest?: RestCountry): null | string {
  const nativeName = Object.values(rest?.name?.nativeName ?? {})[0]?.common;

  return clean(nativeName) || null;
}

export function max(values: number[], fallback = 0): number {
  return values.length > 0 ? Math.max(...values) : fallback;
}

export function median(values: number[]): number {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);

  return sorted[Math.floor(sorted.length / 2)] ?? 1;
}

export function min(values: number[], fallback = 0): number {
  return values.length > 0 ? Math.min(...values) : fallback;
}

export function nearbyRegions(
  region: FinalRegion,
  regions: FinalRegion[],
): Array<{ distance: number; region: FinalRegion }> {
  if (!region.centroid) {
    return [];
  }

  return regions
    .filter((candidate) => candidate !== region && candidate.centroid)
    .map((candidate) => ({
      distance: distanceKm(
        region.centroid?.latitude ?? 0,
        region.centroid?.longitude ?? 0,
        candidate.centroid?.latitude ?? 0,
        candidate.centroid?.longitude ?? 0,
      ),
      region: candidate,
    }))
    .sort((a, b) => a.distance - b.distance);
}

export function overrideFor(
  overrides: Record<string, Record<string, unknown>>,
  ...keys: string[]
): Record<string, unknown> {
  for (const key of keys) {
    const value = overrides[key] ?? overrides[key.toUpperCase()];
    if (value) {
      return value;
    }
  }

  return {};
}

export function parseNumber(value: string | undefined): null | number {
  const cleaned = clean(value);

  if (!cleaned) {
    return null;
  }

  const parsed = Number(cleaned);

  return Number.isFinite(parsed) ? parsed : null;
}

export function pickBoolean(override: Record<string, unknown>, keys: string[]): boolean | null {
  for (const key of keys) {
    const value = override[key];
    if (typeof value === "boolean") {
      return value;
    }
  }

  return null;
}

export function pickNumber(override: Record<string, unknown>, keys: string[]): null | number {
  for (const key of keys) {
    const value = override[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
  }

  return null;
}

export function pickString(override: Record<string, unknown>, keys: string[]): null | string {
  for (const key of keys) {
    const value = override[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

export function runwayUses(type: AirportType, runway: RunwayInfo): number {
  const baseByType: Record<AirportType, number> = {
    large_airport: 650,
    medium_airport: 180,
    small_airport: 45,
  };
  const runwayFactor = clamp(runway.maxLengthM / 3500, 0.2, 1.35);
  const runwayCountFactor = clamp(0.75 + 0.18 * Math.sqrt(Math.max(runway.count, 1)), 0.8, 1.35);
  const nightFactor = runway.worksAtNight ? 1.15 : 0.75;

  return clamp(Math.round(baseByType[type] * runwayFactor * runwayCountFactor * nightFactor), 20, 1200);
}

export function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

export function validCoordinates(latitude: number, longitude: number): boolean {
  return Number.isFinite(latitude) && Number.isFinite(longitude) && latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180;
}

export function weightedCentroid(airports: Array<Omit<FinalAirport, "payload">>): null | Point {
  const total = sum(airports.map((airport) => airportWeight(airport.type)));

  if (total <= 0) {
    return null;
  }

  return {
    latitude: sum(airports.map((airport) => airport.latitude * airportWeight(airport.type))) / total,
    longitude: sum(airports.map((airport) => airport.longitude * airportWeight(airport.type))) / total,
  };
}

export function cityPopulationShares(cities: GeoCity[], countryIso: string, regionCodes: string[]): Map<string, number> {
  const regionSet = new Set(regionCodes);
  const populationByRegion = new Map<string, number>();
  const countryCities = cities.filter((city) => city.countryCode === countryIso && city.population > 0);

  for (const city of countryCities) {
    const code = `${countryIso}-${city.admin1Code}`.toUpperCase();
    if (regionSet.has(code)) {
      populationByRegion.set(code, (populationByRegion.get(code) ?? 0) + city.population);
    }
  }

  const total = sum([...populationByRegion.values()]);

  return new Map([...populationByRegion].map(([code, population]) => [code, total > 0 ? population / total : 0]));
}
