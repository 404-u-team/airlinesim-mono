import { mkdir } from "node:fs/promises";

import type { BuildOptions, SourceIssueSink } from "../shared/types";
import type { ImportLogger } from "./logger";

import { indexRestCountries, loadRestCountries, type RestCountry } from "./rest-countries";
import { fetchCachedText, loadCachedText } from "./source-fetch";
import { loadCachedZip } from "./source-zip";
import { getImportPaths, parseCsv, parseTsv, readJsonFile } from "./storage";
import { loadWorldBankCountries, loadWorldBankIndicator, type WorldBankCountry } from "./world-bank";

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
  openapEngines: "https://raw.githubusercontent.com/junzis/openap/refs/heads/master/openap/data/engine/engines.csv",
  openapFuel: "https://raw.githubusercontent.com/junzis/openap/refs/heads/master/openap/data/fuel/fuel_models.csv",
  openflightsPlanes: "https://raw.githubusercontent.com/jpatokal/openflights/refs/heads/master/data/planes.dat",
  regions: "https://davidmegginson.github.io/ourairports-data/regions.csv",
  runways: "https://davidmegginson.github.io/ourairports-data/runways.csv",
};

export async function loadRawSources(options: BuildOptions, issues: SourceIssueSink, log?: ImportLogger): Promise<RawSources> {
  const paths = getImportPaths(options.dataDir);
  const refreshRaw = options.refreshRaw ?? options.source === "fetch";
  const [
    openflightsPlanes, openapFuel, openapEngines, openapAircraftYamlFiles,
    airports, countries, regions, runways, restRows, wbCountries, wbPopulation,
    wbGdp, wbTourism, geoAdmin1, geoCities, manual
  ] = await Promise.all([
    fetchCachedText(`${paths.rawDir}/openflights-planes.dat`, URLS.openflightsPlanes, refreshRaw, log),
    fetchCachedText(`${paths.rawDir}/openap-fuel.csv`, URLS.openapFuel, refreshRaw, log),
    fetchCachedText(`${paths.rawDir}/openap-engines.csv`, URLS.openapEngines, refreshRaw, log),
    loadOpenapAircraftYamlFiles(paths.rawDir, refreshRaw, issues, log),
    loadCsv(`${paths.rawDir}/airports.csv`, URLS.airports, "ident", refreshRaw, log),
    loadCsv(`${paths.rawDir}/countries.csv`, URLS.countries, "code", refreshRaw, log),
    loadCsv(`${paths.rawDir}/regions.csv`, URLS.regions, "iso_country", refreshRaw, log),
    loadCsv(`${paths.rawDir}/runways.csv`, URLS.runways, "airport_ident", refreshRaw, log),
    loadRestCountries(paths.rawDir, refreshRaw, log),
    loadWorldBankCountries(paths.rawDir, refreshRaw, issues, log),
    loadWorldBankIndicator(paths.rawDir, "population", refreshRaw, issues, log),
    loadWorldBankIndicator(paths.rawDir, "gdp", refreshRaw, issues, log),
    loadWorldBankIndicator(paths.rawDir, "tourism", refreshRaw, issues, log),
    loadGeoAdmin1(`${paths.rawDir}/admin1CodesASCII.txt`, refreshRaw, log),
    loadCachedZip(`${paths.rawDir}/cities5000.txt`, URLS.geoCities, "cities5000.txt", refreshRaw, parseGeoCities, log),
    loadManual(paths.manualDir),
  ]);

  return {
    airports, countries, geoAdmin1, geoCities, manual,
    openapAircraftYamlFiles, openapEngines, openapFuel,
    openflightsPlanes, regions, restCountries: indexRestCountries(restRows),
    runways, worldBankCountries: wbCountries, worldBankGdp: wbGdp,
    worldBankPopulation: wbPopulation, worldBankTourism: wbTourism,
  };
}

async function loadOpenapAircraftYamlFiles(
  rawDir: string,
  refreshRaw: boolean,
  issues: SourceIssueSink,
  log?: ImportLogger,
): Promise<Array<{ filename: string; content: string }>> {
  const listPath = `${rawDir}/openap-file-list.json`;
  const fileListUrl = "https://api.github.com/repos/junzis/openap/contents/openap/data/aircraft";

  const filenames = await loadCachedText(listPath, fileListUrl, refreshRaw, parseOpenapFilenames, log);

  const yamlFiles: Array<{ filename: string; content: string }> = [];
  const yamlDir = `${rawDir}/openap-aircraft`;

  await mkdir(yamlDir, { recursive: true });

  for (const filename of filenames) {
    const downloadUrl = `https://raw.githubusercontent.com/junzis/openap/refs/heads/master/openap/data/aircraft/${filename}`;
    try {
      const content = await fetchCachedText(`${yamlDir}/${filename}`, downloadUrl, refreshRaw, log);
      yamlFiles.push({ content, filename });
    } catch (error) {
      issues.warn("aircraft-type", filename, `Failed to download OpenAP file ${filename}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (yamlFiles.length === 0) {
    throw new Error("Could not load any OpenAP aircraft files");
  }

  return yamlFiles;
}

function parseOpenapFilenames(text: string): string[] {
  const payload = JSON.parse(text) as Array<null | { name?: string }>;
  const names = Array.isArray(payload) ? payload.flatMap((file) =>
    file?.name && /^[a-z0-9]+\.yml$/iu.test(file.name) ? [file.name] : []) : [];
  if (names.length === 0) {
    throw new Error("OpenAP did not return a list of aircraft files");
  }
  return names;
}

async function loadCsv(path: string, url: string, column: string, refreshRaw: boolean, log?: ImportLogger): Promise<Array<Record<string, string>>> {
  return loadCachedText(path, url, refreshRaw, (text) => {
    const rows = parseCsv(text);
    if (!rows[0]?.[column]) {
      throw new Error(`Invalid CSV from ${url}: missing data for ${column}`);
    }
    return rows;
  }, log);
}

async function loadGeoAdmin1(path: string, refreshRaw: boolean, log?: ImportLogger): Promise<Map<string, string>> {
  return loadCachedText(path, URLS.geoAdmin1, refreshRaw, (text) => {
    const rows = parseTsv(text).filter((row) => row.length >= 4);
    if (rows.length === 0) {
      throw new Error("GeoNames admin1 contains no regions");
    }
    return new Map(rows.map((row) => [row[0] ?? "", normalizeName(row[2] ?? row[1] ?? "")]));
  }, log);
}

function parseGeoCities(text: string): GeoCity[] {
  const rows = parseTsv(text).filter((row) => row.length >= 19);
  if (rows.length === 0) {
    throw new Error("GeoNames cities5000 contains no cities");
  }
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

export function normalizeName(value: string): string {
  return value.trim().toLowerCase().replaceAll(/[^a-z0-9]+/gu, " ").trim();
}
