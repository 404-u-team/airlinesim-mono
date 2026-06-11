import type { AnchorRecord } from "./anchors";
import type { CalibrationLogger } from "./calibration-runner";

// Live anchor source: Eurostat `avia_par_<cc>` (air passenger transport by pairs of
// airports), PAS_BRD passengers carried, latest pre-pandemic full year. JSON-stat
// format. Best-effort and defensive — any failure is swallowed so calibration falls
// back to seed/cached anchors. EU-only by nature; non-EU propensity is imputed or
// seeded. Docs: https://ec.europa.eu/eurostat/web/transport/data/database
// (dataset avia_par_*), API: dissemination statistics 1.0.

const EUROSTAT_BASE = "https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data";
// Reporting countries to pull (lowercase ISO2). Kept modest to bound runtime.
const EUROSTAT_COUNTRIES = ["de", "fr", "es", "it", "nl", "pl", "se", "at", "el", "pt", "be", "dk", "fi", "ie"];
const EUROSTAT_YEAR = "2019";
const MIN_DAILY_PAX = 20;

// Minimal slice of the JSON-stat response we use.
type JsonStat = {
  dimension?: { airp_pr?: { category?: { index?: Record<string, number> } } };
  id?: string[];
  size?: number[];
  value?: Record<string, number>;
};

export async function fetchEurostatAnchors(
  icaoToIata: Map<string, string>,
  log?: CalibrationLogger
): Promise<AnchorRecord[]> {
  log?.({
    level: "info",
    message: `Starting Eurostat anchor fetch for ${String(EUROSTAT_COUNTRIES.length)} countries...`,
    operation: "eurostat.fetch_start",
    stage: "fetching",
  });

  const perCountry = await Promise.all(
    EUROSTAT_COUNTRIES.map(async (country) => fetchCountry(country, icaoToIata, log))
  );

  const all = perCountry.flat();
  log?.({
    level: "info",
    message: `Completed Eurostat anchor fetch. Retrieved ${String(all.length)} total raw records.`,
    operation: "eurostat.fetch_complete",
    stage: "fetching",
  });
  return all;
}

function collectRecords(
  value: Record<string, number>,
  stride: number,
  airpSize: number,
  codeByPosition: Map<number, string>,
  icaoToIata: Map<string, string>,
): AnchorRecord[] {
  const out: AnchorRecord[] = [];
  for (const [flatKey, annual] of Object.entries(value)) {
    const record = toAnchor(annual, codeByPosition.get(Math.floor(Number(flatKey) / stride) % airpSize), icaoToIata);
    if (record) {
      out.push(record);
    }
  }
  return out;
}

async function fetchCountry(
  country: string,
  icaoToIata: Map<string, string>,
  log?: CalibrationLogger
): Promise<AnchorRecord[]> {
  const code = country.toUpperCase();
  log?.({
    level: "info",
    message: `Fetching Eurostat dataset avia_par_${country} for country ${code}`,
    operation: "eurostat.fetch_country_start",
    stage: "fetching",
  });
  try {
    const url = `${EUROSTAT_BASE}/avia_par_${country}?format=JSON&unit=PAS&tra_meas=PAS_BRD&freq=A&time=${EUROSTAT_YEAR}`;
    const response = await fetch(url);
    if (!response.ok) {
      log?.({
        level: "warning",
        message: `Eurostat request failed for country ${code} with status ${String(response.status)}`,
        operation: "eurostat.fetch_country_failed",
        stage: "fetching",
      });
      return [];
    }
    const parsed = parseEurostat((await response.json()) as JsonStat, icaoToIata);
    log?.({
      level: "info",
      message: `Successfully fetched and parsed ${String(parsed.length)} anchors for country ${code}`,
      operation: "eurostat.fetch_country_success",
      stage: "fetching",
    });
    return parsed;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    log?.({
      level: "warning",
      message: `Error fetching Eurostat dataset for country ${code}: ${msg}`,
      operation: "eurostat.fetch_country_error",
      stage: "fetching",
    });
    return []; // Seed/cached anchors cover the gap.
  }
}

function invertIndex(index: Record<string, number>): Map<number, string> {
  const byPosition = new Map<number, string>();
  for (const [code, position] of Object.entries(index)) {
    byPosition.set(position, code);
  }
  return byPosition;
}

// airp_pr code looks like "DE_EDDF_ES_LEMD" → ICAO EDDF / LEMD.
function parseAirportPair(code: string | undefined, icaoToIata: Map<string, string>): null | { destIata: string; originIata: string } {
  const parts = code?.split("_") ?? [];
  if (parts.length < 4) {
    return null;
  }
  const originIata = icaoToIata.get((parts[1] ?? "").toUpperCase());
  const destIata = icaoToIata.get((parts[3] ?? "").toUpperCase());
  if (!originIata || !destIata || originIata === destIata) {
    return null;
  }
  return { destIata, originIata };
}

function parseEurostat(payload: JsonStat, icaoToIata: Map<string, string>): AnchorRecord[] {
  const { dimension, id = [], size = [], value } = payload;
  const categoryIndex = dimension?.airp_pr?.category?.index;
  const airpIndex = id.indexOf("airp_pr");
  const airpSize = size[airpIndex] ?? 0;
  if (!value || !categoryIndex || airpIndex < 0 || airpSize <= 0) {
    return [];
  }
  const stride = size.slice(airpIndex + 1).reduce((product, n) => product * n, 1);
  return collectRecords(value, stride, airpSize, invertIndex(categoryIndex), icaoToIata);
}

function toAnchor(annual: number, code: string | undefined, icaoToIata: Map<string, string>): AnchorRecord | null {
  if (typeof annual !== "number" || annual <= 0) {
    return null;
  }
  const pair = parseAirportPair(code, icaoToIata);
  // Annual carried (both directions) → one-way per day.
  const dailyPax = annual / 365 / 2;
  if (!pair || dailyPax < MIN_DAILY_PAX) {
    return null;
  }
  return { dailyPax: Math.round(dailyPax), destIata: pair.destIata, originIata: pair.originIata, source: "eurostat" };
}
