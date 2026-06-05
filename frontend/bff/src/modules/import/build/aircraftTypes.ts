import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import type {
  AircraftTypePayload,
  BuildOptions,
  FinalAircraftType,
  SourceIssueSink,
} from "../shared/types";
import type { AircraftMetadataRow } from "../runtime/sources";

import {
  getImportPaths,
  readJsonFile,
  writeJsonFile,
} from "../runtime/storage";
import { clean, pickNumber, pickString } from "./shared";

type AircraftFamilyProfile = Pick<
  AircraftTypePayload,
  | "cruising_speed_kph"
  | "fuel_consumption_per_hour"
  | "maint_cost_per_flight_hour"
  | "max_planned_seat_capacity"
  | "max_range_km"
  | "min_runway_length_m"
  | "mtow_kg"
  | "price_per_unit"
>;

type AircraftMetadata = {
  manufacturer: SupportedManufacturer;
  model: string;
  observedAircraft: number;
  typeCode: string;
};

type OverrideField<TField extends keyof AircraftTypePayload> = {
  aliases: string[];
  field: TField;
};

type SupportedManufacturer = keyof typeof SEEDED_MANUFACTURER_IDS;

type AircraftVisualImage = {
  commonsFile?: string;
  imageUrl?: string;
  pageUrl?: string;
  qid?: string;
  searchQuery?: string;
  source?: string;
  title?: string;
};

type WikidataSearchItem = {
  description?: string;
  id?: string;
  label?: string;
};

type WikidataSearchResponse = {
  search?: WikidataSearchItem[];
};

type WikidataEntityResponse = {
  entities?: Record<
    string,
    {
      claims?: {
        P18?: Array<{
          mainsnak?: {
            datavalue?: {
              value?: string;
            };
          };
        }>;
      };
      labels?: {
        en?: {
          value?: string;
        };
      };
      sitelinks?: {
        enwiki?: {
          title?: string;
          url?: string;
        };
      };
    }
  >;
};

type CommonsImageInfoResponse = {
  query?: {
    pages?: Record<
      string,
      {
        imageinfo?: Array<{
          mime?: string;
          url?: string;
        }>;
      }
    >;
  };
};

const AIRCRAFT_TYPE_LIMIT = 80;
const AIRCRAFT_IMAGES_CACHE_FILE = "aircraft-visual-images.json";
const WIKIMEDIA_USER_AGENT = "AirlineSim-Import-Agent/1.0";

// First run may still do many requests: search -> entity -> commons.
// Keep this conservative to avoid Wikimedia 429.
const WIKIMEDIA_MIN_DELAY_MS = 1_500;
const WIKIMEDIA_MAX_RETRIES = 4;
const WIKIDATA_SEARCH_LIMIT = 3;
const WIKIDATA_QIDS_TO_CHECK = 2;

let lastWikimediaRequestAt = 0;

const SEEDED_MANUFACTURER_IDS = {
  Airbus: "22222222-2222-2222-2222-222222222222",
  ATR: "44444444-4444-4444-4444-444444444444",
  Boeing: "11111111-1111-1111-1111-111111111111",
  Embraer: "33333333-3333-3333-3333-333333333333",
} as const;

type NumberField = keyof Pick<
  AircraftTypePayload,
  | "base_maintenance_points"
  | "base_turnaround_points"
  | "cruising_speed_kph"
  | "d_check_interval_fh"
  | "d_check_interval_years"
  | "d_check_overdue_multiplier"
  | "fuel_consumption_per_hour"
  | "maint_cost_per_flight_hour"
  | "maint_cost_per_landing"
  | "maint_cost_per_takeoff"
  | "max_planned_seat_capacity"
  | "max_range_km"
  | "min_runway_length_m"
  | "mtow_kg"
  | "price_per_unit"
  | "production_points_price"
>;

type StringField = keyof Pick<
  AircraftTypePayload,
  | "characteristics"
  | "iata_code"
  | "icao_code"
  | "image_upload_id"
  | "model_name"
>;

const NUMBER_OVERRIDE_FIELDS: Array<OverrideField<NumberField>> = [
  {
    aliases: ["base_maintenance_points", "baseMaintenancePoints"],
    field: "base_maintenance_points",
  },
  {
    aliases: ["base_turnaround_points", "baseTurnaroundPoints"],
    field: "base_turnaround_points",
  },
  {
    aliases: ["cruising_speed_kph", "cruisingSpeedKph"],
    field: "cruising_speed_kph",
  },
  {
    aliases: ["d_check_interval_fh", "dCheckIntervalFh"],
    field: "d_check_interval_fh",
  },
  {
    aliases: ["d_check_interval_years", "dCheckIntervalYears"],
    field: "d_check_interval_years",
  },
  {
    aliases: ["d_check_overdue_multiplier", "dCheckOverdueMultiplier"],
    field: "d_check_overdue_multiplier",
  },
  {
    aliases: ["fuel_consumption_per_hour", "fuelConsumptionPerHour"],
    field: "fuel_consumption_per_hour",
  },
  {
    aliases: ["maint_cost_per_flight_hour", "maintCostPerFlightHour"],
    field: "maint_cost_per_flight_hour",
  },
  {
    aliases: ["maint_cost_per_landing", "maintCostPerLanding"],
    field: "maint_cost_per_landing",
  },
  {
    aliases: ["maint_cost_per_takeoff", "maintCostPerTakeoff"],
    field: "maint_cost_per_takeoff",
  },
  {
    aliases: ["max_planned_seat_capacity", "maxPlannedSeatCapacity"],
    field: "max_planned_seat_capacity",
  },
  { aliases: ["max_range_km", "maxRangeKm"], field: "max_range_km" },
  {
    aliases: ["min_runway_length_m", "minRunwayLengthM"],
    field: "min_runway_length_m",
  },
  { aliases: ["mtow_kg", "mtowKg"], field: "mtow_kg" },
  { aliases: ["price_per_unit", "pricePerUnit"], field: "price_per_unit" },
  {
    aliases: ["production_points_price", "productionPointsPrice"],
    field: "production_points_price",
  },
];

const STRING_OVERRIDE_FIELDS: Array<OverrideField<StringField>> = [
  { aliases: ["characteristics"], field: "characteristics" },
  { aliases: ["iata_code", "iataCode"], field: "iata_code" },
  { aliases: ["icao_code", "icaoCode"], field: "icao_code" },
  { aliases: ["image_upload_id", "imageUploadId"], field: "image_upload_id" },
  { aliases: ["model_name", "modelName"], field: "model_name" },
];

export async function buildAircraftTypes(
  issues: SourceIssueSink,
  overrides: Record<string, Record<string, unknown>>,
  metadataRows: AircraftMetadataRow[] = [],
  options: BuildOptions = {},
): Promise<FinalAircraftType[]> {
  const metadata = aggregateMetadata(metadataRows, issues).slice(
    0,
    AIRCRAFT_TYPE_LIMIT,
  );
  const payloads = metadata
    .map((source) => applyOverride(buildPayloadFromMetadata(source), overrides))
    .filter((payload): payload is AircraftTypePayload => Boolean(payload));
  const withImages = await enrichAircraftImages(payloads, options, issues);
  const deduplicated = deduplicateIataCodes(withImages, issues);
  const seenIcao = new Set<string>();

  return deduplicated
    .filter((payload) => {
      const sourceKey = sourceKeyFor(payload);

      if (!payload.manufacturer_id) {
        issues.skip(
          "aircraft-type",
          sourceKey,
          "Aircraft manufacturer is not available in backend; add manufacturer_id manual override",
        );
        return false;
      }

      if (seenIcao.has(payload.icao_code)) {
        issues.error(
          "aircraft-type",
          sourceKey,
          "Duplicate aircraft type ICAO code",
        );
        return false;
      }

      seenIcao.add(payload.icao_code);

      return true;
    })
    .map((payload) => ({
      payload,
      sourceKey: sourceKeyFor(payload),
    }));
}

function deduplicateIataCodes(
  payloads: AircraftTypePayload[],
  issues: SourceIssueSink,
): AircraftTypePayload[] {
  let resolvedPayloads = [...payloads];
  let hasCollisions = true;
  let iterations = 0;

  while (hasCollisions && iterations < 5) {
    hasCollisions = false;
    iterations++;

    const iataCounts = new Map<string, number>();
    for (const p of resolvedPayloads) {
      if (p.iata_code) {
        iataCounts.set(p.iata_code, (iataCounts.get(p.iata_code) ?? 0) + 1);
      }
    }

    resolvedPayloads = resolvedPayloads.map((p) => {
      if (p.iata_code && iataCounts.get(p.iata_code)! > 1) {
        const last3Icao = p.icao_code.length >= 3
          ? p.icao_code.slice(-3).toUpperCase()
          : p.icao_code.toUpperCase();
        
        if (p.iata_code !== last3Icao) {
          hasCollisions = true;
          issues.warn(
            "aircraft-type",
            sourceKeyFor(p),
            `Deduplicating IATA code collision for ${p.icao_code}: changing IATA code from ${p.iata_code} to ${last3Icao}`,
          );
          return {
            ...p,
            iata_code: last3Icao,
          };
        }
      }
      return p;
    });
  }

  return resolvedPayloads;
}

function aggregateMetadata(
  rows: AircraftMetadataRow[],
  issues: SourceIssueSink,
): AircraftMetadata[] {
  const groups = new Map<string, AircraftMetadata>();

  for (const row of rows) {
    const typeCode = clean(
      row.typecode ?? row.typeCode ?? row.icao_code,
    ).toUpperCase();
    const manufacturer = supportedManufacturer(
      row.manufacturername ?? row.manufacturerName ?? "",
    );
    const model = clean(row.model);

    if (!/^[A-Z0-9]{3,4}$/u.test(typeCode) || !manufacturer || !model) {
      continue;
    }

    const existing = groups.get(typeCode);
    groups.set(typeCode, {
      manufacturer,
      model: bestModelName(existing?.model, model),
      observedAircraft: (existing?.observedAircraft ?? 0) + 1,
      typeCode,
    });
  }

  if (groups.size === 0) {
    issues.warn(
      "aircraft-type",
      "aircraft-type:opensky",
      "OpenSky aircraft metadata did not contain supported aircraft types",
    );
  }

  return [...groups.values()].sort(
    (left, right) => right.observedAircraft - left.observedAircraft,
  );
}

function applyNumberOverrides(
  source: AircraftTypePayload,
  override: Record<string, unknown>,
): AircraftTypePayload {
  const payload: AircraftTypePayload = { ...source };

  for (const { aliases, field } of NUMBER_OVERRIDE_FIELDS) {
    const value = pickNumber(override, aliases);

    if (value != null) {
      payload[field] = value;
    }
  }

  return payload;
}

function applyOverride(
  source: AircraftTypePayload,
  overrides: Record<string, Record<string, unknown>>,
): AircraftTypePayload {
  const override =
    overrides[source.icao_code] ?? overrides[source.model_name] ?? {};
  const manufacturerId =
    pickString(override, ["manufacturer_id", "manufacturerId"]) ??
    source.manufacturer_id;
  const payload = applyStringOverrides(
    applyNumberOverrides(source, override),
    override,
  );

  return manufacturerId
    ? { ...payload, manufacturer_id: manufacturerId }
    : payload;
}

function applyStringOverrides(
  source: AircraftTypePayload,
  override: Record<string, unknown>,
): AircraftTypePayload {
  const payload: AircraftTypePayload = { ...source };

  for (const { aliases, field } of STRING_OVERRIDE_FIELDS) {
    const value = pickString(override, aliases);

    if (value != null) {
      payload[field] =
        field === "iata_code" || field === "icao_code"
          ? value.toUpperCase()
          : value;
    }
  }

  return payload;
}

function bestModelName(current: string | undefined, next: string): string {
  if (!current || next.length > current.length) {
    return next;
  }

  return current;
}

function buildCharacteristics(
  source: AircraftMetadata,
  profile: AircraftFamilyProfile,
): string {
  return JSON.stringify({
    category: aircraftCategory(profile.max_planned_seat_capacity),
    rangeClass: rangeClass(profile.max_range_km),
    realWorldMetadata: {
      manufacturer: source.manufacturer,
      model: source.model,
      observedAircraft: source.observedAircraft,
      source: "OpenSky Aircraft Metadata Database",
    },
    runwayClass: runwayClass(profile.min_runway_length_m),
  });
}

function buildPayloadFromMetadata(
  source: AircraftMetadata,
): AircraftTypePayload {
  const profile = estimateProfile(source);

  return {
    ...profile,
    base_maintenance_points: Math.max(
      8_000,
      Math.round(profile.maint_cost_per_flight_hour * 5),
    ),
    base_turnaround_points: Math.max(
      20,
      Math.round(profile.max_planned_seat_capacity / 6),
    ),
    characteristics: buildCharacteristics(source, profile),
    d_check_interval_fh: 24_000,
    d_check_interval_years: 6,
    d_check_overdue_multiplier: 1.35,
    iata_code: fallbackIataCode(source.typeCode),
    icao_code: source.typeCode,
    image_upload_id: "",
    maint_cost_per_landing: Math.round(
      profile.maint_cost_per_flight_hour * 0.8,
    ),
    maint_cost_per_takeoff: Math.round(
      profile.maint_cost_per_flight_hour * 0.9,
    ),
    manufacturer_id: SEEDED_MANUFACTURER_IDS[source.manufacturer],
    model_name: canonicalModelName(source),
    production_points_price: Math.max(
      100,
      Math.round(profile.price_per_unit / 50_000),
    ),
  };
}

function canonicalModelName(source: AircraftMetadata): string {
  const model = source.model
    .toUpperCase()
    .startsWith(source.manufacturer.toUpperCase())
    ? source.model
    : `${source.manufacturer} ${source.model}`;

  return model.replaceAll(/\s+/gu, " ").trim();
}

function aircraftCategory(seats: number): string {
  if (seats >= 300) {
    return "widebody";
  }
  if (seats >= 100) {
    return "narrowbody";
  }

  return "regional";
}

function estimateProfile(source: AircraftMetadata): AircraftFamilyProfile {
  const text =
    `${source.manufacturer} ${source.model} ${source.typeCode}`.toUpperCase();

  if (text.includes("A380")) {
    return profile(525, 14800, 903, 12000, 2900, 575000, 445600000, 11800);
  }
  if (
    text.includes("A350") ||
    text.includes("B787") ||
    text.includes("B789") ||
    text.includes("B788")
  ) {
    return profile(315, 14500, 903, 6400, 2500, 260000, 305000000, 6800);
  }
  if (text.includes("A330") || text.includes("B777") || text.includes("B767")) {
    return profile(300, 11800, 885, 7600, 2500, 240000, 265000000, 6200);
  }
  if (text.includes("A321") || text.includes("B757")) {
    return profile(220, 6800, 840, 5500, 1700, 97000, 130000000, 3100);
  }
  if (
    text.includes("A320") ||
    text.includes("A319") ||
    text.includes("B737") ||
    text.includes("B738") ||
    text.includes("B38")
  ) {
    return profile(180, 6200, 839, 4800, 1550, 79000, 111000000, 2700);
  }
  if (
    text.includes("A220") ||
    text.includes("BCS") ||
    text.includes("E190") ||
    text.includes("E195") ||
    text.includes("E290")
  ) {
    return profile(120, 5300, 835, 2600, 1300, 61000, 62000000, 1500);
  }
  if (text.includes("ATR") || text.includes("AT7") || text.includes("AT4")) {
    return profile(78, 1530, 510, 760, 1050, 23000, 26000000, 850);
  }

  return profile(120, 4000, 780, 2500, 1500, 60000, 65000000, 1600);
}

async function enrichAircraftImages(
  payloads: AircraftTypePayload[],
  options: BuildOptions,
  issues: SourceIssueSink,
): Promise<AircraftTypePayload[]> {
  const cachePath = `${getImportPaths(options.dataDir).rawDir}/${AIRCRAFT_IMAGES_CACHE_FILE}`;
  const cache = await readJsonFile<Record<string, AircraftVisualImage>>(
    cachePath,
    {},
  );
  let changed = false;

  const shouldFetchMissing = false; // TODO: fix 429 from wikipedia or found new source

  for (const payload of payloads) {
    if (cache[payload.icao_code] && !options.refreshRaw) {
      continue;
    }

    if (!shouldFetchMissing) {
      continue;
    }

    const image = await fetchAircraftVisualImage(payload, options, issues);

    if (image?.imageUrl) {
      cache[payload.icao_code] = image;
      changed = true;
    } else {
      issues.warn(
        "aircraft-type",
        sourceKeyFor(payload),
        "Aircraft visual image was not found",
      );
    }
  }

  if (changed) {
    await writeJsonFile(cachePath, cache);
  }

  return payloads.map((payload) =>
    addImageToCharacteristics(payload, cache[payload.icao_code]),
  );
}

async function fetchAircraftVisualImage(
  payload: AircraftTypePayload,
  options: BuildOptions,
  issues: SourceIssueSink,
): Promise<AircraftVisualImage | null> {
  // Keep only Wikidata/Commons here. The previous Wikipedia Summary fallback adds extra requests
  // and tends to trigger 429 during the first full import.
  return fetchWikidataAircraftImage(payload, options, issues);
}

async function fetchWikidataAircraftImage(
  payload: AircraftTypePayload,
  options: BuildOptions,
  issues: SourceIssueSink,
): Promise<AircraftVisualImage | null> {
  const queries = wikidataQueriesForAircraft(payload);

  for (const query of queries) {
    const qids = await searchWikidataAircraft(query, options, issues, payload);

    for (const qid of qids.slice(0, WIKIDATA_QIDS_TO_CHECK)) {
      const details = await fetchWikidataAircraftDetails(
        qid,
        query,
        options,
        issues,
        payload,
      );

      if (details?.imageUrl) {
        return details;
      }
    }
  }

  return null;
}

function wikidataQueriesForAircraft(payload: AircraftTypePayload): string[] {
  const modelName = clean(payload.model_name);
  const icaoCode = clean(payload.icao_code).toUpperCase();
  const manufacturer = aircraftManufacturerName(payload);
  const realWorldModel = aircraftRealWorldModel(payload);
  const normalizedModel = normalizeAircraftModelForSearch(modelName, icaoCode);

  return uniqueStrings([
    `${normalizedModel} aircraft`,
    normalizedModel,
    `${manufacturer} ${realWorldModel} aircraft`,
    `${manufacturer} ${realWorldModel}`,
    `${modelName} aircraft`,
    modelName,
    realWorldModel ? `${realWorldModel} aircraft` : "",
    realWorldModel,
    icaoCode,
  ]);
}

async function searchWikidataAircraft(
  query: string,
  options: BuildOptions,
  issues: SourceIssueSink,
  payload: AircraftTypePayload,
): Promise<string[]> {
  try {
    const cacheFile = `${getImportPaths(options.dataDir).rawDir}/wikidata-search-${safeFileName(query)}.json`;
    const url = [
      "https://www.wikidata.org/w/api.php",
      "?action=wbsearchentities",
      `&search=${encodeURIComponent(query)}`,
      "&language=en",
      "&format=json",
      `&limit=${WIKIDATA_SEARCH_LIMIT}`,
    ].join("");

    const text = await fetchCachedWikimediaText(
      cacheFile,
      url,
      options.refreshRaw === true,
    );
    const data = JSON.parse(text) as WikidataSearchResponse;

    return (data.search ?? [])
      .filter((item) => Boolean(item.id))
      .sort(
        (left, right) =>
          wikidataAircraftSearchScore(right) -
          wikidataAircraftSearchScore(left),
      )
      .map((item) => item.id)
      .filter((id): id is string => Boolean(id));
  } catch (error) {
    issues.warn(
      "aircraft-type",
      sourceKeyFor(payload),
      `Wikidata search failed for "${query}": ${formatError(error)}`,
    );

    return [];
  }
}

function wikidataAircraftSearchScore(item: WikidataSearchItem): number {
  const text = `${item.label ?? ""} ${item.description ?? ""}`.toLowerCase();
  let score = 0;

  if (text.includes("aircraft")) {
    score += 10;
  }
  if (text.includes("airliner")) {
    score += 10;
  }
  if (text.includes("airplane")) {
    score += 8;
  }
  if (text.includes("jet")) {
    score += 4;
  }
  if (text.includes("turboprop")) {
    score += 4;
  }
  if (text.includes("narrow-body") || text.includes("wide-body")) {
    score += 3;
  }
  if (text.includes("family")) {
    score += 2;
  }

  if (text.includes("airport")) {
    score -= 15;
  }
  if (text.includes("airline")) {
    score -= 12;
  }
  if (
    text.includes("accident") ||
    text.includes("incident") ||
    text.includes("crash")
  ) {
    score -= 12;
  }
  if (text.includes("flight ")) {
    score -= 8;
  }

  return score;
}

async function fetchWikidataAircraftDetails(
  qid: string,
  searchQuery: string,
  options: BuildOptions,
  issues: SourceIssueSink,
  payload: AircraftTypePayload,
): Promise<AircraftVisualImage | null> {
  try {
    const cacheFile = `${getImportPaths(options.dataDir).rawDir}/wikidata-entity-${qid}.json`;
    const url = `https://www.wikidata.org/wiki/Special:EntityData/${qid}.json`;

    const text = await fetchCachedWikimediaText(
      cacheFile,
      url,
      options.refreshRaw === true,
    );
    const data = JSON.parse(text) as WikidataEntityResponse;
    const entity = data.entities?.[qid];
    const commonsFile = entity?.claims?.P18?.[0]?.mainsnak?.datavalue?.value;

    if (!commonsFile) {
      return null;
    }

    const imageUrl = await fetchCommonsImageUrl(
      commonsFile,
      options,
      issues,
      payload,
    );

    if (!imageUrl) {
      return null;
    }

    return {
      commonsFile,
      imageUrl,
      pageUrl: entity?.sitelinks?.enwiki?.url,
      qid,
      searchQuery,
      source: "Wikidata/Wikimedia Commons",
      title: entity?.labels?.en?.value ?? entity?.sitelinks?.enwiki?.title,
    };
  } catch (error) {
    issues.warn(
      "aircraft-type",
      sourceKeyFor(payload),
      `Wikidata entity fetch failed for "${qid}": ${formatError(error)}`,
    );

    return null;
  }
}

async function fetchCommonsImageUrl(
  commonsFile: string,
  options: BuildOptions,
  issues: SourceIssueSink,
  payload: AircraftTypePayload,
): Promise<string | null> {
  try {
    const cacheFile = `${getImportPaths(options.dataDir).rawDir}/commons-image-${safeFileName(commonsFile)}.json`;
    const url = [
      "https://commons.wikimedia.org/w/api.php",
      "?action=query",
      `&titles=File:${encodeURIComponent(commonsFile)}`,
      "&prop=imageinfo",
      "&iiprop=url|mime",
      "&format=json",
    ].join("");

    const text = await fetchCachedWikimediaText(
      cacheFile,
      url,
      options.refreshRaw === true,
    );
    const data = JSON.parse(text) as CommonsImageInfoResponse;
    const pages = data.query?.pages ?? {};
    const firstPage = Object.values(pages)[0];

    return firstPage?.imageinfo?.[0]?.url ?? null;
  } catch (error) {
    issues.warn(
      "aircraft-type",
      sourceKeyFor(payload),
      `Commons image URL fetch failed for "${commonsFile}": ${formatError(error)}`,
    );

    return null;
  }
}

async function fetchCachedWikimediaText(
  cachePath: string,
  url: string,
  refresh: boolean,
): Promise<string> {
  if (!refresh) {
    try {
      return await readFile(cachePath, "utf8");
    } catch {
      // Cache miss. Fetch below.
    }
  }

  const text = await fetchWikimediaTextWithRetry(url);

  await mkdir(dirname(cachePath), { recursive: true });
  await writeFile(cachePath, text, "utf8");

  return text;
}

async function fetchWikimediaTextWithRetry(url: string): Promise<string> {
  let lastError: unknown = null;

  for (let attempt = 0; attempt <= WIKIMEDIA_MAX_RETRIES; attempt++) {
    await waitForWikimediaThrottle();

    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "Api-User-Agent": WIKIMEDIA_USER_AGENT,
        "User-Agent": WIKIMEDIA_USER_AGENT,
      },
    });

    if (response.ok) {
      return response.text();
    }

    if (response.status === 429 || response.status === 503) {
      const retryAfterMs = retryAfterToMs(response.headers.get("retry-after"));
      const backoffMs = retryAfterMs ?? exponentialBackoffMs(attempt);

      lastError = new Error(
        `${response.status} ${response.statusText}; retrying after ${backoffMs}ms`,
      );
      await sleep(backoffMs);
      continue;
    }

    throw new Error(`${response.status} ${response.statusText}`);
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Wikimedia request failed after retries");
}

async function waitForWikimediaThrottle(): Promise<void> {
  const now = Date.now();
  const waitMs = Math.max(
    0,
    WIKIMEDIA_MIN_DELAY_MS - (now - lastWikimediaRequestAt),
  );

  if (waitMs > 0) {
    await sleep(waitMs);
  }

  lastWikimediaRequestAt = Date.now();
}

function retryAfterToMs(value: string | null): number | null {
  if (!value) {
    return null;
  }

  const seconds = Number(value);

  if (Number.isFinite(seconds)) {
    return Math.max(1_000, seconds * 1_000);
  }

  const dateMs = Date.parse(value);

  if (Number.isFinite(dateMs)) {
    return Math.max(1_000, dateMs - Date.now());
  }

  return null;
}

function exponentialBackoffMs(attempt: number): number {
  return Math.min(60_000, 2_000 * 2 ** attempt);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function addImageToCharacteristics(
  payload: AircraftTypePayload,
  image: AircraftVisualImage | undefined,
): AircraftTypePayload {
  if (!image?.imageUrl) {
    return payload;
  }

  return {
    ...payload,
    characteristics: JSON.stringify({
      ...parseCharacteristics(payload.characteristics),
      visual: {
        commonsFile: image.commonsFile,
        imageUrl: image.imageUrl,
        pageUrl: image.pageUrl,
        qid: image.qid,
        searchQuery: image.searchQuery,
        source: image.source ?? "Wikidata/Wikimedia Commons",
        title: image.title,
      },
    }),
  };
}

function aircraftManufacturerName(payload: AircraftTypePayload): string {
  const fromCharacteristics = aircraftRealWorldMetadataValue(
    payload,
    "manufacturer",
  );

  if (fromCharacteristics) {
    return fromCharacteristics;
  }

  const modelName = clean(payload.model_name).toUpperCase();

  if (modelName.includes("AIRBUS")) {
    return "Airbus";
  }
  if (modelName.includes("BOEING")) {
    return "Boeing";
  }
  if (modelName.includes("EMBRAER")) {
    return "Embraer";
  }
  if (modelName.includes("ATR")) {
    return "ATR";
  }

  return "";
}

function aircraftRealWorldModel(payload: AircraftTypePayload): string {
  return aircraftRealWorldMetadataValue(payload, "model");
}

function aircraftRealWorldMetadataValue(
  payload: AircraftTypePayload,
  key: string,
): string {
  const characteristics = parseCharacteristics(payload.characteristics);
  const metadata = characteristics.realWorldMetadata;

  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return "";
  }

  const value = (metadata as Record<string, unknown>)[key];

  return typeof value === "string" ? clean(value) : "";
}

function fallbackIataCode(typeCode: string): string {
  return typeCode.length <= 3 ? typeCode : typeCode.slice(0, 3);
}

function parseCharacteristics(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function profile(
  maxPlannedSeatCapacity: number,
  maxRangeKm: number,
  cruisingSpeedKph: number,
  fuelConsumptionPerHour: number,
  minRunwayLengthM: number,
  mtowKg: number,
  pricePerUnit: number,
  maintCostPerFlightHour: number,
): AircraftFamilyProfile {
  return {
    cruising_speed_kph: cruisingSpeedKph,
    fuel_consumption_per_hour: fuelConsumptionPerHour,
    maint_cost_per_flight_hour: maintCostPerFlightHour,
    max_planned_seat_capacity: maxPlannedSeatCapacity,
    max_range_km: maxRangeKm,
    min_runway_length_m: minRunwayLengthM,
    mtow_kg: mtowKg,
    price_per_unit: pricePerUnit,
  };
}

function rangeClass(rangeKm: number): string {
  if (rangeKm >= 10_000) {
    return "long-haul";
  }
  if (rangeKm >= 4500) {
    return "medium-haul";
  }

  return "regional";
}

function runwayClass(runwayM: number): string {
  if (runwayM >= 2400) {
    return "long";
  }
  if (runwayM >= 1400) {
    return "medium";
  }

  return "short";
}

function normalizeAircraftModelForSearch(
  modelName: string,
  icaoCode: string,
): string {
  const text = `${modelName} ${icaoCode}`.toUpperCase();

  if (text.includes("A220") || text.includes("BCS")) {
    return "Airbus A220";
  }
  if (
    text.includes("A19N") ||
    text.includes("A20N") ||
    text.includes("A21N") ||
    text.includes("A320NEO")
  ) {
    return "Airbus A320neo family";
  }
  if (
    text.includes("A318") ||
    text.includes("A319") ||
    text.includes("A320") ||
    text.includes("A321")
  ) {
    return "Airbus A320 family";
  }
  if (text.includes("A330")) {
    return "Airbus A330";
  }
  if (text.includes("A340")) {
    return "Airbus A340";
  }
  if (text.includes("A350")) {
    return "Airbus A350";
  }
  if (text.includes("A380") || icaoCode === "A388") {
    return "Airbus A380";
  }

  if (
    text.includes("B38") ||
    text.includes("B39") ||
    text.includes("737 MAX")
  ) {
    return "Boeing 737 MAX";
  }
  if (
    text.includes("B737") ||
    text.includes("B738") ||
    text.includes("B739") ||
    text.includes("737")
  ) {
    return "Boeing 737";
  }
  if (text.includes("B747") || text.includes("747")) {
    return "Boeing 747";
  }
  if (text.includes("B757") || text.includes("757")) {
    return "Boeing 757";
  }
  if (text.includes("B767") || text.includes("767")) {
    return "Boeing 767";
  }
  if (text.includes("B777") || text.includes("B77") || text.includes("777")) {
    return "Boeing 777";
  }
  if (text.includes("B787") || text.includes("B78") || text.includes("787")) {
    return "Boeing 787 Dreamliner";
  }

  if (
    text.includes("E190") ||
    text.includes("E195") ||
    text.includes("E290") ||
    text.includes("E295")
  ) {
    return "Embraer E-Jet E2 family";
  }
  if (
    text.includes("E170") ||
    text.includes("E175") ||
    text.includes("E190") ||
    text.includes("E195")
  ) {
    return "Embraer E-Jet family";
  }

  if (text.includes("ATR") || text.includes("AT7") || text.includes("AT72")) {
    return "ATR 72";
  }
  if (text.includes("AT4") || text.includes("AT42")) {
    return "ATR 42";
  }

  return modelName;
}

function safeFileName(value: string): string {
  return value
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/gu, "-")
    .replaceAll(/^-|-$/gu, "");
}

function sourceKeyFor(payload: AircraftTypePayload): string {
  return `aircraft-type:${clean(payload.icao_code).toUpperCase()}`;
}

function supportedManufacturer(value: string): SupportedManufacturer | null {
  const normalized = clean(value).toUpperCase();

  if (normalized.includes("AIRBUS")) {
    return "Airbus";
  }
  if (normalized.includes("BOEING")) {
    return "Boeing";
  }
  if (normalized.includes("EMBRAER")) {
    return "Embraer";
  }
  if (
    normalized.includes("ATR") ||
    normalized.includes("AVIONS DE TRANSPORT")
  ) {
    return "ATR";
  }

  return null;
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
