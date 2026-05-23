import type { AirportRow, CountryRow, RawSources, RestCountry } from "../runtime/sources";
import type { CountryPayload, FinalCountry } from "../shared/types";
import type { BuildContext, CountryStats } from "./types";

import { clamp, normalizeLog, roundTo, safeDiv } from "../shared/math";
import {
  clean,
  continentFromRest,
  fallbackCorpTax,
  fallbackGdp,
  fallbackVat,
  localCountryName,
  max,
  median,
  min,
  overrideFor,
  pickNumber,
  pickString,
} from "./shared";

export function buildCountries(
  context: BuildContext,
  selectedCountries: Set<string>,
  selectedAirportRows: AirportRow[],
): FinalCountry[] {
  const ourAirports = new Map(context.raw.countries.map((country) => [clean(country.code).toUpperCase(), country]));
  const airportScores = airportScoreByCountry(selectedAirportRows);
  const stats = buildCountryStats(context.raw, selectedCountries, airportScores);

  return [...selectedCountries].sort().map((iso) => {
    const row = ourAirports.get(iso);
    const rest = context.raw.restCountries.get(iso);
    const iso3 = rest?.cca3 ?? "";
    const wbCountry = context.raw.worldBankCountries.get(iso);
    const incomeLevelCode = wbCountry?.incomeLevel?.id ?? null;
    const override = overrideFor(context.raw.manual.countries, iso, `country:${iso}`);
    const population = context.raw.worldBankPopulation.get(iso3) ?? rest?.population ?? null;
    const gdp = context.raw.worldBankGdp.get(iso3) ?? null;
    const tourism = context.raw.worldBankTourism.get(iso3) ?? null;
    const continent = clean(row?.continent ?? continentFromRest(rest));
    const payload = countryPayload(context, {
      areaKm2: rest?.area ?? null,
      continent,
      countryAirportScore: airportScores.get(iso) ?? 0,
      gdpPerCapitaUsd: gdp,
      incomeLevelCode,
      iso,
      override,
      population,
      rest,
      row,
      stats,
    });

    return {
      areaKm2: rest?.area ?? null,
      borders: rest?.borders ?? [],
      continent,
      gdpPerCapitaUsd: gdp,
      incomeLevelCode,
      iso,
      landlocked: rest?.landlocked ?? false,
      languages: Object.values(rest?.languages ?? {}),
      payload,
      population,
      sourceKey: `country:${iso}`,
      tourismArrivals: tourism,
    };
  });
}

function airportScoreByCountry(rows: AirportRow[]): Map<string, number> {
  const scores = new Map<string, number>();
  const scoreByType: Record<string, number> = {
    large_airport: 1,
    medium_airport: 0.45,
    small_airport: 0.12,
  };

  for (const row of rows) {
    const iso = clean(row.iso_country).toUpperCase();
    scores.set(iso, (scores.get(iso) ?? 0) + (scoreByType[clean(row.type)] ?? 0));
  }

  return scores;
}

function buildCountryStats(
  raw: RawSources,
  selectedCountries: Set<string>,
  airportScores: Map<string, number>,
): CountryStats {
  const countries = [...selectedCountries].map((iso) => {
    const rest = raw.restCountries.get(iso);
    const iso3 = rest?.cca3 ?? "";
    const wbCountry = raw.worldBankCountries.get(iso);

    return {
      airportScore: airportScores.get(iso) ?? 0,
      area: rest?.area ?? 100000,
      gdp: raw.worldBankGdp.get(iso3) ?? fallbackGdp(wbCountry?.incomeLevel?.id ?? null),
      population: raw.worldBankPopulation.get(iso3) ?? rest?.population ?? 1000000,
    };
  });

  return {
    airportScoreMax: max(countries.map((country) => country.airportScore)),
    airportScoreMin: min(countries.map((country) => country.airportScore)),
    areaMax: max(countries.map((country) => country.area)),
    areaMin: min(countries.map((country) => country.area)),
    globalMedianGdp: median(countries.map((country) => country.gdp)),
    populationMax: max(countries.map((country) => country.population)),
    populationMin: min(countries.map((country) => country.population)),
  };
}

function countryPayload(
  context: BuildContext,
  input: {
    areaKm2: null | number;
    continent: string;
    countryAirportScore: number;
    gdpPerCapitaUsd: null | number;
    incomeLevelCode: null | string;
    iso: string;
    override: Record<string, unknown>;
    population: null | number;
    rest?: RestCountry;
    row?: CountryRow;
    stats: CountryStats;
  },
): CountryPayload {
  const gdp = input.gdpPerCapitaUsd ?? fallbackGdp(input.incomeLevelCode);
  const wealthFactor = Math.sqrt(clamp(safeDiv(gdp, input.stats.globalMedianGdp, 1), 0.15, 5));
  const populationNorm = normalizeLog(input.population ?? 1_000_000, input.stats.populationMin, input.stats.populationMax);
  const areaNorm = normalizeLog(input.areaKm2 ?? 100_000, input.stats.areaMin, input.stats.areaMax);
  const airportScoreNorm = normalizeLog(input.countryAirportScore, input.stats.airportScoreMin, input.stats.airportScoreMax);
  const hubFactor = 1 + airportScoreNorm * 0.35;
  const taxOverride = pickNumber(input.override, ["corp_tax_rate", "corpTaxRate"]);
  const vatOverride = pickNumber(input.override, ["vat_rate", "vatRate"]);
  const tailCode = pickString(input.override, ["aircraft_tail_code", "aircraftTailCode"]) ?? "";

  if (taxOverride == null || vatOverride == null) {
    context.issues.reportQuality?.("countriesUsingTaxFallback");
  }
  if (!tailCode) {
    context.issues.reportQuality?.("countriesWithoutTailCode");
  }

  return {
    aircraft_tail_code: tailCode,
    corp_tax_rate: clamp(taxOverride ?? fallbackCorpTax(input.incomeLevelCode), 0, 60),
    flythrough_permission_price: clamp(roundTo(250 * wealthFactor * (1 + areaNorm * 0.15) * hubFactor * (pickNumber(input.override, ["flythrough_permission_multiplier", "flythroughPermissionMultiplier"]) ?? 1), 10), 50, 2500),
    intl_name: pickString(input.override, ["intl_name", "intlName"]) ?? clean(input.rest?.name?.common ?? input.row?.name),
    iso: input.iso,
    land_permission_price: clamp(roundTo(2000 * wealthFactor * (1 + populationNorm * 0.75) * hubFactor * (pickNumber(input.override, ["land_permission_multiplier", "landPermissionMultiplier"]) ?? 1), 100), 500, 25000),
    local_name: pickString(input.override, ["local_name", "localName"]) ?? localCountryName(input.rest) ?? clean(input.row?.name),
    vat_rate: clamp(vatOverride ?? fallbackVat(input.incomeLevelCode, input.continent), 0, 35),
    wikipedia_link: pickString(input.override, ["wikipedia_link", "wikipediaLink"]) ?? clean(input.row?.wikipedia_link),
  };
}
