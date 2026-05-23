import type { BuildOptions } from "../shared/types";

import {
  fetchCachedText,
  fetchCachedZipText,
  getImportPaths,
  parseCsv,
  parseTsv,
  readJsonFile,
} from "./storage";

export type AirportRow = Record<string, string>;
export type CountryRow = Record<string, string>;
export type RegionRow = Record<string, string>;
export type RunwayRow = Record<string, string>;

export type GeoCity = {
  admin1Code: string;
  countryCode: string;
  latitude: number;
  longitude: number;
  name: string;
  population: number;
  timezone: string;
};

export type RestCountry = {
  area?: number;
  borders?: string[];
  capital?: string[];
  cca2?: string;
  cca3?: string;
  landlocked?: boolean;
  languages?: Record<string, string>;
  latlng?: number[];
  name?: { common?: string; nativeName?: Record<string, { common?: string }> };
  population?: number;
  region?: string;
  subregion?: string;
  translations?: Record<string, { common?: string }>;
};

export type WorldBankCountry = {
  id?: string;
  incomeLevel?: { id?: string };
  iso2Code?: string;
};

export type WorldBankValue = {
  countryiso3code?: string;
  value?: null | number;
};

export type ManualOverrides = {
  airports: Record<string, Record<string, unknown>>;
  countries: Record<string, Record<string, unknown>>;
  regionLinks: Record<string, Record<string, unknown>>;
  regions: Record<string, Record<string, unknown>>;
};

export type RawSources = {
  airports: AirportRow[];
  countries: CountryRow[];
  geoAdmin1: Map<string, string>;
  geoCities: GeoCity[];
  manual: ManualOverrides;
  regions: RegionRow[];
  restCountries: Map<string, RestCountry>;
  runways: RunwayRow[];
  worldBankCountries: Map<string, WorldBankCountry>;
  worldBankGdp: Map<string, number>;
  worldBankPopulation: Map<string, number>;
  worldBankTourism: Map<string, number>;
};

const URLS = {
  airports: "https://davidmegginson.github.io/ourairports-data/airports.csv",
  countries: "https://davidmegginson.github.io/ourairports-data/countries.csv",
  geoAdmin1: "https://download.geonames.org/export/dump/admin1CodesASCII.txt",
  geoCities: "https://download.geonames.org/export/dump/cities5000.zip",
  geoTimeZones: "https://download.geonames.org/export/dump/timeZones.txt",
  regions: "https://davidmegginson.github.io/ourairports-data/regions.csv",
  restCountriesA:
    "https://restcountries.com/v3.1/all?fields=cca2,cca3,name,translations,region,subregion,capital,area,population,languages",
  restCountriesB: "https://restcountries.com/v3.1/all?fields=cca2,landlocked,borders,latlng",
  runways: "https://davidmegginson.github.io/ourairports-data/runways.csv",
  wbCountries: "https://api.worldbank.org/v2/country?format=json&per_page=400",
  wbGdp:
    "https://api.worldbank.org/v2/country/all/indicator/NY.GDP.PCAP.CD?format=json&per_page=20000&MRV=1",
  wbPopulation:
    "https://api.worldbank.org/v2/country/all/indicator/SP.POP.TOTL?format=json&per_page=20000&MRV=1",
  wbTourism:
    "https://api.worldbank.org/v2/country/all/indicator/ST.INT.ARVL?format=json&per_page=20000&MRV=1",
};

export async function loadRawSources(options: BuildOptions): Promise<RawSources> {
  const paths = getImportPaths(options.dataDir);
  const refreshRaw = options.refreshRaw ?? options.source === "fetch";
  const [
    airports,
    countries,
    regions,
    runways,
    restA,
    restB,
    wbCountries,
    wbPopulation,
    wbGdp,
    wbTourism,
    geoAdmin1,
    geoCities,
    manual,
  ] = await Promise.all([
    loadCsv(`${paths.rawDir}/airports.csv`, URLS.airports, refreshRaw),
    loadCsv(`${paths.rawDir}/countries.csv`, URLS.countries, refreshRaw),
    loadCsv(`${paths.rawDir}/regions.csv`, URLS.regions, refreshRaw),
    loadCsv(`${paths.rawDir}/runways.csv`, URLS.runways, refreshRaw),
    loadJson<RestCountry[]>(`${paths.rawDir}/rest-countries-a.json`, URLS.restCountriesA, refreshRaw),
    loadJson<RestCountry[]>(`${paths.rawDir}/rest-countries-b.json`, URLS.restCountriesB, refreshRaw),
    loadWorldBankCountries(`${paths.rawDir}/worldbank-countries.json`, refreshRaw),
    loadWorldBankValues(`${paths.rawDir}/worldbank-population.json`, URLS.wbPopulation, refreshRaw),
    loadWorldBankValues(`${paths.rawDir}/worldbank-gdp.json`, URLS.wbGdp, refreshRaw),
    loadWorldBankValues(`${paths.rawDir}/worldbank-tourism.json`, URLS.wbTourism, refreshRaw),
    loadGeoAdmin1(`${paths.rawDir}/admin1CodesASCII.txt`, refreshRaw),
    loadGeoCities(`${paths.rawDir}/cities5000.zip`, refreshRaw),
    loadManual(paths.manualDir),
  ]);

  return {
    airports,
    countries,
    geoAdmin1,
    geoCities,
    manual,
    regions,
    restCountries: joinRestCountries(restA, restB),
    runways,
    worldBankCountries: wbCountries,
    worldBankGdp: wbGdp,
    worldBankPopulation: wbPopulation,
    worldBankTourism: wbTourism,
  };
}

async function loadCsv(path: string, url: string, refreshRaw: boolean): Promise<Array<Record<string, string>>> {
  return parseCsv(await fetchCachedText(path, url, refreshRaw));
}

async function loadGeoAdmin1(path: string, refreshRaw: boolean): Promise<Map<string, string>> {
  const rows = parseTsv(await fetchCachedText(path, URLS.geoAdmin1, refreshRaw));

  return new Map(rows.map((row) => [row[0] ?? "", normalizeName(row[2] ?? row[1] ?? "")]));
}

async function loadGeoCities(path: string, refreshRaw: boolean): Promise<GeoCity[]> {
  const rows = parseTsv(await fetchCachedZipText(path, URLS.geoCities, "cities5000.txt", refreshRaw));

  return rows.map((row) => ({
    admin1Code: row[10] ?? "",
    countryCode: row[8] ?? "",
    latitude: Number(row[4] ?? "NaN"),
    longitude: Number(row[5] ?? "NaN"),
    name: row[2] ?? row[1] ?? "",
    population: Number(row[14] ?? "0"),
    timezone: row[17] ?? "",
  }));
}

async function loadJson<TValue>(path: string, url: string, refreshRaw: boolean): Promise<TValue> {
  const text = await fetchCachedText(path, url, refreshRaw);

  return JSON.parse(text) as TValue;
}

async function loadManual(manualDir: string): Promise<ManualOverrides> {
  const [countries, regions, airports, regionLinks] = await Promise.all([
    readJsonFile<Record<string, Record<string, unknown>>>(`${manualDir}/countries.json`, {}),
    readJsonFile<Record<string, Record<string, unknown>>>(`${manualDir}/regions.json`, {}),
    readJsonFile<Record<string, Record<string, unknown>>>(`${manualDir}/airports.json`, {}),
    readJsonFile<Record<string, Record<string, unknown>>>(`${manualDir}/region-links.json`, {}),
  ]);

  return { airports, countries, regionLinks, regions };
}

async function loadWorldBankCountries(path: string, refreshRaw: boolean): Promise<Map<string, WorldBankCountry>> {
  const payload = await loadJson<unknown[]>(path, URLS.wbCountries, refreshRaw);
  const rows = Array.isArray(payload[1]) ? (payload[1] as WorldBankCountry[]) : [];

  return new Map(rows.filter((row) => row.iso2Code).map((row) => [row.iso2Code ?? "", row]));
}

async function loadWorldBankValues(path: string, url: string, refreshRaw: boolean): Promise<Map<string, number>> {
  const payload = await loadJson<unknown[]>(path, url, refreshRaw);
  const rows = Array.isArray(payload[1]) ? (payload[1] as WorldBankValue[]) : [];

  return new Map(
    rows
      .filter((row) => row.countryiso3code && typeof row.value === "number")
      .map((row) => [row.countryiso3code ?? "", row.value ?? 0]),
  );
}

function joinRestCountries(left: RestCountry[], right: RestCountry[]): Map<string, RestCountry> {
  const byIso = new Map(left.filter((country) => country.cca2).map((country) => [country.cca2 ?? "", country]));

  for (const country of right) {
    if (country.cca2) {
      byIso.set(country.cca2, { ...byIso.get(country.cca2), ...country });
    }
  }

  return byIso;
}

function normalizeName(value: string): string {
  return value.trim().toLowerCase().replaceAll(/[^a-z0-9]+/gu, " ");
}
