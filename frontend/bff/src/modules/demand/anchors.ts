import type { CalibrationLogger } from "./calibration-runner";

import { readDocument, writeDocument } from "../../db/database";
import { fetchEurostatAnchors } from "./eurostat-anchors";

// Real-world anchor traffic used to calibrate the model (Layer 2). Each record is
// observed one-way passengers per day for an airport pair (IATA). Decision: fetch
// live from Eurostat and cache locally; reuse the cache unless `refresh` is set. A
// vendored seed set keeps calibration working offline / before the first fetch and
// covers regions Eurostat does not (US/RU/TR). See docs/passenger-demand-model.md.

const ANCHORS_DOC = "demand-anchors";

export type AnchorRecord = {
  dailyPax: number;
  destIata: string;
  originIata: string;
  source: string;
};

export type AnchorStore = {
  fetchedAt?: string;
  records: AnchorRecord[];
};

// Approximate pre-pandemic one-way pax/day. Deliberately coarse — refined by the
// live Eurostat fetch; non-EU rows give the fit signal for those countries.
export const SEED_ANCHORS: AnchorRecord[] = [
  seed("MAD", "BCN", 5200), seed("FCO", "MXP", 3000), seed("LHR", "EDI", 5000),
  seed("LHR", "GLA", 2800), seed("CDG", "NCE", 3800), seed("CDG", "TLS", 3200),
  seed("BER", "MUC", 3800), seed("FRA", "BER", 2500), seed("FRA", "MUC", 2800),
  seed("LIS", "OPO", 1500), seed("ARN", "GOT", 1500), seed("ATH", "SKG", 2500),
  seed("WAW", "KRK", 900), seed("VIE", "ZRH", 1800), seed("LHR", "CDG", 5500),
  seed("LHR", "AMS", 5000), seed("LHR", "FRA", 3500), seed("LHR", "DUB", 5000),
  seed("CDG", "FCO", 2500), seed("AMS", "BCN", 2500), seed("FRA", "IST", 2200),
  seed("MUC", "IST", 1800), seed("FRA", "JFK", 2200), seed("LHR", "JFK", 3500),
  seed("CDG", "JFK", 2500), seed("BER", "CGN", 550), seed("BER", "STR", 900),
  // Non-EU coverage (no Eurostat): US / RU / TR.
  seed("JFK", "LAX", 4000), seed("LAX", "SFO", 4500), seed("ORD", "LGA", 2500),
  seed("SVO", "LED", 8000), seed("SVO", "AER", 6500), seed("IST", "AYT", 6000),
  seed("IST", "ESB", 5000),
];

export async function getCalibrationAnchors(options: {
  fetcher?: typeof fetchEurostatAnchors;
  icaoToIata?: Map<string, string>;
  log?: CalibrationLogger;
  refresh?: boolean;
}): Promise<AnchorStore> {
  const stored = loadStoredAnchors();

  if (!options.refresh && stored.records.length > 0) {
    options.log?.({
      level: "info",
      message: `Using ${String(stored.records.length)} locally cached anchors (last fetched at ${stored.fetchedAt ?? "unknown"}).`,
      operation: "anchors.cache_hit",
      stage: "fetching",
    });
    return stored;
  }

  if (!options.refresh) {
    options.log?.({
      level: "info",
      message: "No cached anchors found. Initializing with seed anchors.",
      operation: "anchors.seed",
      stage: "fetching",
    });
    return saveAnchors(SEED_ANCHORS);
  }

  const fetcher = options.fetcher ?? fetchEurostatAnchors;
  let fetched: AnchorRecord[] = [];
  try {
    fetched = await fetcher(options.icaoToIata ?? new Map<string, string>(), options.log);
  } catch (error) {
    options.log?.({
      level: "warning",
      message: `Eurostat anchor fetch failed: ${error instanceof Error ? error.message : String(error)}. Falling back to seed/cached anchors.`,
      operation: "anchors.fetch_failed",
      stage: "fetching",
    });
    console.warn("Eurostat anchor fetch failed, keeping seed/cached anchors:", error);
  }

  return saveAnchors(mergeAnchors(SEED_ANCHORS, fetched));
}

export function loadStoredAnchors(): AnchorStore {
  return readDocument<AnchorStore>(ANCHORS_DOC, { records: [] });
}

export function saveAnchors(records: AnchorRecord[]): AnchorStore {
  const store: AnchorStore = { fetchedAt: new Date().toISOString(), records };
  writeDocument(ANCHORS_DOC, store);
  return store;
}

// Fetched (live) records win over seed for the same pair.
function mergeAnchors(seedRecords: AnchorRecord[], fetched: AnchorRecord[]): AnchorRecord[] {
  const byKey = new Map<string, AnchorRecord>();
  for (const record of seedRecords) {
    byKey.set(pairKey(record), record);
  }
  for (const record of fetched) {
    byKey.set(pairKey(record), record);
  }
  return [...byKey.values()];
}

function pairKey(record: AnchorRecord): string {
  return [record.originIata.toUpperCase(), record.destIata.toUpperCase()].sort().join("~");
}

function seed(originIata: string, destIata: string, dailyPax: number): AnchorRecord {
  return { dailyPax, destIata, originIata, source: "seed" };
}
