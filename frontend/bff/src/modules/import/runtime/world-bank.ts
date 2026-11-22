import type { SourceIssueSink } from "../shared/types";
import type { ImportLogger } from "./logger";

import { loadCachedText } from "./source-fetch";
import { loadCachedZip } from "./source-zip";
import { parseCsv } from "./storage";

const API_BASE = "https://api.worldbank.org/v2";

type Indicator = "gdp" | "population" | "tourism";

const INDICATORS: Record<Indicator, string> = {
  gdp: "NY.GDP.PCAP.CD",
  population: "SP.POP.TOTL",
  tourism: "ST.INT.ARVL",
};

export type WorldBankCountry = {
  id: string;
  incomeLevel?: { id?: string };
  iso2Code: string;
};

type LegacyValue = {
  countryiso3code?: string;
  value?: null | number;
};

export async function loadWorldBankCountries(
  rawDir: string,
  refreshRaw: boolean,
  issues: SourceIssueSink,
  log?: ImportLogger,
): Promise<Map<string, WorldBankCountry>> {
  const path = `${rawDir}/worldbank-countries.json`;
  const url = `${API_BASE}/country?format=json&per_page=400`;
  try {
    return await loadCachedText(path, url, refreshRaw, parseCountries, log);
  } catch (error) {
    issues.warn("country", "worldbank-countries", `Using default income levels: ${errorMessage(error)}`);
    return new Map();
  }
}

export async function loadWorldBankIndicator(
  rawDir: string,
  indicator: Indicator,
  refreshRaw: boolean,
  issues: SourceIssueSink,
  log?: ImportLogger,
): Promise<Map<string, number>> {
  const code = INDICATORS[indicator];
  const prefix = `${rawDir}/worldbank-${indicator}`;
  const url = `${API_BASE}/en/indicator/${code}?downloadformat=csv`;
  const entry = new RegExp(`^API_${code.replaceAll(".", "\\.")}_DS2_.*\\.csv$`, "u");

  try {
    return await loadCachedZip(`${prefix}.csv`, url, entry, refreshRaw, (text) => parseIndicator(text, code), log);
  } catch (error) {
    const legacy = await readLegacyValues(`${prefix}.json`);
    const fallback = legacy.size > 0 ? "Using cached World Bank JSON" : "Using estimates for missing values";
    issues.warn("country", `worldbank-${indicator}`, `${fallback} (${code}): ${errorMessage(error)}`);
    return legacy;
  }
}

function parseCountries(text: string): Map<string, WorldBankCountry> {
  const [meta, rows] = parseRows<null | WorldBankCountry>(text);
  if ((meta.pages != null && Number(meta.pages) !== 1) || !rows.every((row) => row?.iso2Code && row.id)) {
    throw new Error("Unexpected World Bank countries dataset");
  }
  return new Map(rows.filter((row) => row != null).map((row) => [row.iso2Code, row]));
}

function parseIndicator(text: string, code: string): Map<string, number> {
  // The WDI archive starts with source and release-date metadata before the table.
  const headerOffset = text.indexOf('"Country Name","Country Code",');
  if (headerOffset < 0) {
    throw new Error(`World Bank CSV header missing for ${code}`);
  }

  const rows = parseCsv(text.slice(headerOffset));
  const years = Object.keys(rows[0] ?? {}).filter((key) => /^\d{4}$/u.test(key)).sort((a, b) => Number(b) - Number(a));
  const values = new Map<string, number>();
  for (const row of rows) {
    const country = row["Country Code"];
    if (!country || row["Indicator Code"] !== code) {
      continue;
    }
    const value = latestValue(row, years);
    if (value !== undefined) {
      values.set(country, value);
    }
  }
  if (values.size === 0) {
    throw new Error(`World Bank CSV contains no observations for ${code}`);
  }
  return values;
}

function latestValue(row: Record<string, string>, years: string[]): number | undefined {
  for (const year of years) {
    const cell = row[year]?.trim();
    if (cell && Number.isFinite(Number(cell))) {
      return Number(cell);
    }
  }
  return undefined;
}

async function readLegacyValues(path: string): Promise<Map<string, number>> {
  try {
    const [, rows] = parseRows<LegacyValue | null>(await Bun.file(path).text());
    const values = new Map<string, number>();
    for (const row of rows) {
      if (row?.countryiso3code && typeof row.value === "number" && Number.isFinite(row.value)) {
        values.set(row.countryiso3code, row.value);
      }
    }
    return values;
  } catch {
    return new Map();
  }
}

function parseRows<T>(text: string): [{ pages?: number | string }, T[]] {
  const payload = JSON.parse(text) as unknown;
  if (!Array.isArray(payload) || !payload[0] || !Array.isArray(payload[1]) || payload[1].length === 0) {
    throw new Error("Unexpected World Bank JSON dataset");
  }
  return payload as [{ pages?: number | string }, T[]];
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
