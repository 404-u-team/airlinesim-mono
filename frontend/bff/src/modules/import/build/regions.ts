import type { RegionRow } from "../runtime/sources";
import type { FinalCountry, FinalRegion, RegionPayload } from "../shared/types";
import type { AirportShell, BuildContext, RegionDraft, RegionStats } from "./types";

import { clamp, deterministicRange, normalizeLog, round2, safeDiv } from "../shared/math";
import {
  airportWeight,
  cityPopulationShares,
  clean,
  fallbackGdp,
  fallbackTourism,
  groupBy,
  max,
  min,
  overrideFor,
  pickNumber,
  pickString,
  sum,
  weightedCentroid,
} from "./shared";

export function buildRegions(
  context: BuildContext,
  selectedRegions: Set<string>,
  airports: AirportShell[],
  countries: FinalCountry[],
): FinalRegion[] {
  const drafts = buildRegionDrafts(context, selectedRegions, airports, countries);
  const stats = buildRegionStats(drafts);

  return drafts.map((region) => finalizeRegion(context, region, stats));
}

function allocateRegionPopulation(
  context: BuildContext,
  airports: AirportShell[],
  countries: FinalCountry[],
): Map<string, number> {
  const result = new Map<string, number>();
  const airportsByCountry = groupBy(airports, (airport) => airport.countryIso);

  for (const country of countries) {
    const countryAirports = airportsByCountry.get(country.iso) ?? [];
    const population = country.population ?? Math.max(100000, sum(countryAirports.map((airport) => airportWeight(airport.type))) * 500000);
    if (!country.population) {
      context.issues.warn("country", country.sourceKey, "Using airport-weight country population fallback");
      context.issues.reportQuality?.("regionsUsingAirportPopulationFallback");
    }

    allocateCountryRegions(country.iso, population, countryAirports, context, result);
  }

  return result;
}

function allocateCountryRegions(
  countryIso: string,
  population: number,
  countryAirports: AirportShell[],
  context: BuildContext,
  result: Map<string, number>,
): void {
  const regionWeights = new Map<string, number>();
  for (const airport of countryAirports) {
    regionWeights.set(airport.regionCode, (regionWeights.get(airport.regionCode) ?? 0) + airportWeight(airport.type));
  }

  const cityShares = cityPopulationShares(context.raw.geoCities, countryIso, [...regionWeights.keys()]);
  const total = sum([...regionWeights.values()]);
  const shares = [...regionWeights].map(([code, weight]) => {
    const airportShare = safeDiv(weight, total, 0);
    const cityShare = cityShares.get(code);

    return [code, cityShare == null ? airportShare : 0.65 * cityShare + 0.35 * airportShare] as const;
  });
  const shareTotal = sum(shares.map(([, share]) => share));

  for (const [code, share] of shares) {
    result.set(code, Math.max(1000, Math.round(population * safeDiv(share, shareTotal, 0))));
  }
}

function buildRegionDrafts(
  context: BuildContext,
  selectedRegions: Set<string>,
  airports: AirportShell[],
  countries: FinalCountry[],
): RegionDraft[] {
  const countryByIso = new Map(countries.map((country) => [country.iso, country]));
  const rows = new Map(context.raw.regions.map((region) => [clean(region.code).toUpperCase(), region]));
  const regionAirports = groupBy(airports, (airport) => airport.regionCode);
  const populationByRegion = allocateRegionPopulation(context, airports, countries);

  return [...selectedRegions].sort().flatMap((localCode) => {
    const row = rows.get(localCode);
    const regionAirportsValue = regionAirports.get(localCode) ?? [];
    const countryIso = clean(row?.iso_country ?? regionAirportsValue[0]?.countryIso).toUpperCase();
    const country = countryByIso.get(countryIso);

    if (!row || !country || regionAirportsValue.length === 0 || localCode.endsWith("-U-A")) {
      return [];
    }

    return [{
      airportCapacitySum: sum(regionAirportsValue.map((airport) => airport.capacityIndex)),
      centroid: weightedCentroid(regionAirportsValue),
      country,
      localCode,
      population: populationByRegion.get(localCode) ?? 1000,
      row,
    }];
  });
}

function buildRegionStats(regions: RegionDraft[]): RegionStats {
  const gdpPcs = regions.map((region) => region.country.gdpPerCapitaUsd ?? fallbackGdp(region.country.incomeLevelCode));
  const regionalGdps = regions.map((region, index) => region.population * (gdpPcs[index] ?? 0));
  const airportCapacities = regions.map((region) => region.airportCapacitySum);

  return {
    airportCapacityMax: max(airportCapacities),
    airportCapacityMin: min(airportCapacities),
    gdpPcMax: max(gdpPcs),
    gdpPcMin: min(gdpPcs),
    regionalGdpMax: max(regionalGdps),
    regionalGdpMin: min(regionalGdps),
    tourismArrivalsMax: max(regions.map((region) => region.country.tourismArrivals ?? fallbackTourism(region.country))),
    tourismArrivalsMin: min(regions.map((region) => region.country.tourismArrivals ?? fallbackTourism(region.country))),
  };
}

function capitalMatches(country: FinalCountry, row: RegionRow): boolean {
  void country;

  return clean(row.keywords).toLowerCase().includes("capital");
}

function finalizeRegion(context: BuildContext, region: RegionDraft, stats: RegionStats): FinalRegion {
  const override = overrideFor(context.raw.manual.regions, region.localCode, `region:${region.localCode}`);
  const businessScore = pickNumber(override, ["business_score", "businessScore"]) ?? synthBusiness(region, stats, override);
  const gdpPerCapita = clamp(
    pickNumber(override, ["gdp_per_capita", "gdpPerCapita"]) ?? synthRegionGdp(region.country, businessScore, region.localCode),
    300,
    250000,
  );
  const payload: RegionPayload = {
    business_score: round2(businessScore),
    country_id: region.country.sourceKey,
    gdp_per_capita: Math.round(gdpPerCapita),
    intl_name: pickString(override, ["intl_name", "intlName"]) ?? clean(region.row.name),
    local_code: region.localCode,
    local_name: pickString(override, ["local_name", "localName"]) ?? clean(region.row.name),
    population: Math.max(1000, Math.round(pickNumber(override, ["population"]) ?? region.population)),
    tourism_score: round2(pickNumber(override, ["tourism_score", "tourismScore"]) ?? synthTourism(region, stats, override)),
    wikipedia_link: pickString(override, ["wikipedia_link", "wikipediaLink"]) ?? clean(region.row.wikipedia_link),
  };

  return {
    centroid: region.centroid,
    continent: clean(region.row.continent),
    countryIso: region.country.iso,
    localCode: region.localCode,
    payload,
    sourceKey: `region:${region.localCode}`,
  };
}

function synthBusiness(region: RegionDraft, stats: RegionStats, override: Record<string, unknown>): number {
  const gdpPc = region.country.gdpPerCapitaUsd ?? fallbackGdp(region.country.incomeLevelCode);
  const regionalGdpNorm = normalizeLog(region.population * gdpPc, stats.regionalGdpMin, stats.regionalGdpMax);
  const gdpPcNorm = normalizeLog(gdpPc, stats.gdpPcMin, stats.gdpPcMax);
  const airportCapacityScore = normalizeLog(region.airportCapacitySum, stats.airportCapacityMin, stats.airportCapacityMax);
  const capitalBonus = capitalMatches(region.country, region.row) ? 0.1 : 0;
  const manualBonus = pickNumber(override, ["business_bonus", "businessBonus"]) ?? 0;
  const jitter = deterministicRange(`region:${region.localCode}:business`, -0.03, 0.03);

  return clamp(0.45 * regionalGdpNorm + 0.25 * gdpPcNorm + 0.2 * airportCapacityScore + capitalBonus + manualBonus + jitter, 0.01, 1);
}

function synthRegionGdp(country: FinalCountry, businessScore: number, localCode: string): number {
  const countryGdp = country.gdpPerCapitaUsd ?? fallbackGdp(country.incomeLevelCode);
  const gdpJitter = deterministicRange(`region:${localCode}:gdp`, -0.08, 0.08);

  return Math.round(countryGdp * clamp(0.65 + 0.7 * businessScore + gdpJitter, 0.45, 2.2));
}

function synthTourism(region: RegionDraft, stats: RegionStats, override: Record<string, unknown>): number {
  const countryTourism = normalizeLog(region.country.tourismArrivals ?? fallbackTourism(region.country), stats.tourismArrivalsMin, stats.tourismArrivalsMax);
  const airportLeisure = normalizeLog(region.airportCapacitySum, stats.airportCapacityMin, stats.airportCapacityMax);
  const manualBonus = pickNumber(override, ["tourism_bonus", "tourismBonus"]) ?? 0;
  const jitter = deterministicRange(`region:${region.localCode}:tourism`, 0, 1);

  return clamp(0.4 * countryTourism + 0.25 * airportLeisure + 0.2 * manualBonus + 0.15 * jitter, 0.01, 1);
}
