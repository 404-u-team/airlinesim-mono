import type { BuildOptions } from "../shared/types";
import type { ImportLogger } from "./logger";

import { indexRestCountries, loadRestCountries, type RestCountry } from "./rest-countries";
import {
  fetchCachedText,
  fetchCachedZipText,
  getImportPaths,
  loadJsonArray,
  parseCsv,
  parseTsv,
  readJsonFile,
} from "./storage";

export type { RestCountry } from "./rest-countries";

export type AircraftMetadataRow = Record<string, string>;
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
  aircraftTypes: Record<string, Record<string, unknown>>;
  airports: Record<string, Record<string, unknown>>;
  countries: Record<string, Record<string, unknown>>;
  regions: Record<string, Record<string, unknown>>;
};

export type RawSources = {
  airports: AirportRow[];
  countries: CountryRow[];
  geoAdmin1: Map<string, string>;
  geoCities: GeoCity[];
  manual: ManualOverrides;
  openapAircraftYamlFiles: Array<{ filename: string; content: string }>;
  openapEngines: string;
  openapFuel: string;
  openapSynonyms: string;
  openflightsPlanes: string;
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
  openapEngines: "https://raw.githubusercontent.com/junzis/openap/refs/heads/master/openap/data/engine/engines.csv",
  openapFuel: "https://raw.githubusercontent.com/junzis/openap/refs/heads/master/openap/data/fuel/fuel_models.csv",
  openapSynonyms: "https://raw.githubusercontent.com/junzis/openap/refs/heads/master/openap/data/aircraft/_synonym.csv",
  openflightsPlanes: "https://raw.githubusercontent.com/jpatokal/openflights/refs/heads/master/data/planes.dat",
  regions: "https://davidmegginson.github.io/ourairports-data/regions.csv",
  runways: "https://davidmegginson.github.io/ourairports-data/runways.csv",
  wbCountries: "https://api.worldbank.org/v2/country?format=json&per_page=400",
  wbGdp:
    "https://api.worldbank.org/v2/country/all/indicator/NY.GDP.PCAP.CD?format=json&per_page=20000&MRV=1",
  wbPopulation:
    "https://api.worldbank.org/v2/country/all/indicator/SP.POP.TOTL?format=json&per_page=20000&MRV=1",
  wbTourism:
    "https://api.worldbank.org/v2/country/all/indicator/ST.INT.ARVL?format=json&per_page=20000&MRV=1",
};

export async function loadRawSources(options: BuildOptions, log?: ImportLogger): Promise<RawSources> {
  const paths = getImportPaths(options.dataDir);
  const refreshRaw = options.refreshRaw ?? options.source === "fetch";
  const [
    openflightsPlanes, openapSynonyms, openapFuel, openapEngines, openapAircraftYamlFiles,
    airports, countries, regions, runways, restRows, wbCountries, wbPopulation,
    wbGdp, wbTourism, geoAdmin1, geoCities, manual
  ] = await Promise.all([
    fetchCachedText(`${paths.rawDir}/openflights-planes.dat`, URLS.openflightsPlanes, refreshRaw, log),
    fetchCachedText(`${paths.rawDir}/openap-synonyms.csv`, URLS.openapSynonyms, refreshRaw, log),
    fetchCachedText(`${paths.rawDir}/openap-fuel.csv`, URLS.openapFuel, refreshRaw, log),
    fetchCachedText(`${paths.rawDir}/openap-engines.csv`, URLS.openapEngines, refreshRaw, log),
    loadOpenapAircraftYamlFiles(paths.rawDir, refreshRaw, log),
    loadCsv(`${paths.rawDir}/airports.csv`, URLS.airports, refreshRaw, log),
    loadCsv(`${paths.rawDir}/countries.csv`, URLS.countries, refreshRaw, log),
    loadCsv(`${paths.rawDir}/regions.csv`, URLS.regions, refreshRaw, log),
    loadCsv(`${paths.rawDir}/runways.csv`, URLS.runways, refreshRaw, log),
    loadRestCountries(paths.rawDir, refreshRaw, log),
    loadWorldBankCountries(`${paths.rawDir}/worldbank-countries.json`, refreshRaw, log),
    loadWorldBankValues(`${paths.rawDir}/worldbank-population.json`, URLS.wbPopulation, refreshRaw, log),
    loadWorldBankValues(`${paths.rawDir}/worldbank-gdp.json`, URLS.wbGdp, refreshRaw, log),
    loadWorldBankValues(`${paths.rawDir}/worldbank-tourism.json`, URLS.wbTourism, refreshRaw, log),
    loadGeoAdmin1(`${paths.rawDir}/admin1CodesASCII.txt`, refreshRaw, log),
    loadGeoCities(`${paths.rawDir}/cities5000.zip`, refreshRaw, log),
    loadManual(paths.manualDir),
  ]);

  return {
    airports, countries, geoAdmin1, geoCities, manual,
    openapAircraftYamlFiles, openapEngines, openapFuel, openapSynonyms,
    openflightsPlanes, regions, restCountries: indexRestCountries(restRows),
    runways, worldBankCountries: wbCountries, worldBankGdp: wbGdp,
    worldBankPopulation: wbPopulation, worldBankTourism: wbTourism,
  };
}

async function loadOpenapAircraftYamlFiles(
  rawDir: string,
  refreshRaw: boolean,
  log?: ImportLogger,
): Promise<Array<{ filename: string; content: string }>> {
  const listPath = `${rawDir}/openap-file-list.json`;
  const fileListUrl = "https://api.github.com/repos/junzis/openap/contents/openap/data/aircraft";

  const listText = await fetchCachedText(listPath, fileListUrl, refreshRaw, log);
  const files = JSON.parse(listText) as Array<{ download_url?: string; name: string }>;

  const yamlFiles: Array<{ filename: string; content: string }> = [];
  const yamlDir = `${rawDir}/openap-aircraft`;

  const { mkdir } = await import("node:fs/promises");
  await mkdir(yamlDir, { recursive: true });

  const ymlFiles = files.filter((f) => f.name.endsWith(".yml"));

  for (const file of ymlFiles) {
    const filePath = `${yamlDir}/${file.name}`;
    const downloadUrl = `https://raw.githubusercontent.com/junzis/openap/refs/heads/master/openap/data/aircraft/${file.name}`;
    try {
      const content = await fetchCachedText(filePath, downloadUrl, refreshRaw, log);
      yamlFiles.push({ content, filename: file.name });
    } catch (error) {
      log?.({
        entityType: "aircraft-type",
        level: "warning",
        message: `Failed to download OpenAP file ${file.name}: ${error instanceof Error ? error.message : String(error)}`,
        operation: "source.fetch",
        sourceKey: file.name,
        stage: "building",
      });
    }
  }

  return yamlFiles;
}

async function loadCsv(path: string, url: string, refreshRaw: boolean, log?: ImportLogger): Promise<Array<Record<string, string>>> {
  return parseCsv(await fetchCachedText(path, url, refreshRaw, log));
}

async function loadGeoAdmin1(path: string, refreshRaw: boolean, log?: ImportLogger): Promise<Map<string, string>> {
  const rows = parseTsv(await fetchCachedText(path, URLS.geoAdmin1, refreshRaw, log));

  return new Map(rows.map((row) => [row[0] ?? "", normalizeName(row[2] ?? row[1] ?? "")]));
}

async function loadGeoCities(path: string, refreshRaw: boolean, log?: ImportLogger): Promise<GeoCity[]> {
  const rows = parseTsv(await fetchCachedZipText(path, URLS.geoCities, "cities5000.txt", refreshRaw, log));

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

async function loadManual(manualDir: string): Promise<ManualOverrides> {
  const [countries, regions, airports, aircraftTypes] = await Promise.all([
    readJsonFile<Record<string, Record<string, unknown>>>(`${manualDir}/countries.json`, {}),
    readJsonFile<Record<string, Record<string, unknown>>>(`${manualDir}/regions.json`, {}),
    readJsonFile<Record<string, Record<string, unknown>>>(`${manualDir}/airports.json`, {}),
    readJsonFile<Record<string, Record<string, unknown>>>(`${manualDir}/aircraft-types.json`, {}),
  ]);

  return { aircraftTypes, airports, countries, regions };
}

// World Bank API отдает [meta, rows]; rows извлекаются после валидации формы массива.
async function loadWorldBankRows<TRow>(path: string, url: string, refreshRaw: boolean, log?: ImportLogger): Promise<TRow[]> {
  const payload = await loadJsonArray<unknown>(path, url, refreshRaw, log);

  return Array.isArray(payload[1]) ? (payload[1] as TRow[]) : [];
}

async function loadWorldBankCountries(path: string, refreshRaw: boolean, log?: ImportLogger): Promise<Map<string, WorldBankCountry>> {
  const rows = await loadWorldBankRows<WorldBankCountry>(path, URLS.wbCountries, refreshRaw, log);

  return new Map(rows.filter((row) => row.iso2Code).map((row) => [row.iso2Code ?? "", row]));
}

async function loadWorldBankValues(path: string, url: string, refreshRaw: boolean, log?: ImportLogger): Promise<Map<string, number>> {
  const rows = await loadWorldBankRows<WorldBankValue>(path, url, refreshRaw, log);

  return new Map(
    rows
      .filter((row) => row.countryiso3code && typeof row.value === "number")
      .map((row) => [row.countryiso3code ?? "", row.value ?? 0]),
  );
}

export function normalizeName(value: string): string {
  return value.trim().toLowerCase().replaceAll(/[^a-z0-9]+/gu, " ").trim();
}
