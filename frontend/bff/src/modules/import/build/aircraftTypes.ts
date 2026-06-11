import yaml from "js-yaml";
import Papa from "papaparse";

import type {
  AircraftTypePayload,
  BuildOptions,
  FinalAircraftType,
  SourceIssueSink,
} from "../shared/types";
import type { RawSources } from "../runtime/sources";

import {
  getImportPaths,
  readJsonFile,
  writeJsonFile,
} from "../runtime/storage";
import { clean, pickNumber, pickString } from "./shared";

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

const AIRCRAFT_IMAGES_CACHE_FILE = "aircraft-visual-images.json";
const WIKIMEDIA_USER_AGENT = "AirlineSim-Import-Agent/1.0";
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

const NUMBER_OVERRIDE_FIELDS: Array<{ aliases: string[]; field: NumberField }> = [
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
    aliases: ["maint_cost_per_flight_hour", "maintCostPerHour", "maintCostPerFlightHour"],
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

const STRING_OVERRIDE_FIELDS: Array<{ aliases: string[]; field: StringField }> = [
  { aliases: ["characteristics"], field: "characteristics" },
  { aliases: ["iata_code", "iataCode"], field: "iata_code" },
  { aliases: ["icao_code", "icaoCode"], field: "icao_code" },
  { aliases: ["image_upload_id", "imageUploadId"], field: "image_upload_id" },
  { aliases: ["model_name", "modelName"], field: "model_name" },
];

export async function buildAircraftTypes(
  issues: SourceIssueSink,
  overrides: Record<string, Record<string, unknown>>,
  rawSources: RawSources,
  options: BuildOptions = {},
): Promise<FinalAircraftType[]> {
  const synonymsMap = new Map<string, string>();
  try {
    const synonymsRows = Papa.parse(rawSources.openapSynonyms, {
      dynamicTyping: true,
      header: true,
      skipEmptyLines: true,
    }).data as any[];
    for (const r of synonymsRows) {
      if (r.orig && r.target) {
        synonymsMap.set(String(r.orig).toLowerCase(), String(r.target).toLowerCase());
      }
    }
  } catch (e) {
    issues.warn("aircraft-type", "aircraft-type:openap-synonyms", `Failed to parse synonyms: ${String(e)}`);
  }

  const icaoToIata = new Map<string, string>();
  const icaoToName = new Map<string, string>();
  try {
    const planesRows = Papa.parse(rawSources.openflightsPlanes, {
      header: false,
      skipEmptyLines: true,
    }).data as any[];
    for (const r of planesRows) {
      const name = r[0];
      const iata = r[1];
      const icao = r[2];
      if (icao && icao !== "\\N") {
        const cleanIcao = String(icao).toUpperCase();
        if (iata && iata !== "\\N") {
          icaoToIata.set(cleanIcao, String(iata).toUpperCase());
        }
        if (name) {
          icaoToName.set(cleanIcao, String(name));
        }
      }
    }
  } catch (e) {
    issues.warn("aircraft-type", "aircraft-type:openflights-planes", `Failed to parse OpenFlights planes: ${String(e)}`);
  }

  const fuelModels = new Map<string, { c1: number; c2: number; c3: number }>();
  try {
    const fuelRows = Papa.parse(rawSources.openapFuel, {
      dynamicTyping: true,
      header: true,
      skipEmptyLines: true,
    }).data as any[];
    for (const r of fuelRows) {
      if (r.typecode && r.c1 != null) {
        fuelModels.set(String(r.typecode).toLowerCase(), {
          c1: Number(r.c1),
          c2: Number(r.c2),
          c3: Number(r.c3),
        });
      }
    }
  } catch (e) {
    issues.warn("aircraft-type", "aircraft-type:openap-fuel", `Failed to parse fuel models: ${String(e)}`);
  }

  const enginesMap = new Map<string, any>();
  try {
    const enginesRows = Papa.parse(rawSources.openapEngines, {
      dynamicTyping: true,
      header: true,
      skipEmptyLines: true,
    }).data as any[];
    for (const r of enginesRows) {
      if (r.name) {
        enginesMap.set(String(r.name), r);
      }
    }
  } catch (e) {
    issues.warn("aircraft-type", "aircraft-type:openap-engines", `Failed to parse engines: ${String(e)}`);
  }

  const payloads: AircraftTypePayload[] = [];
  const seenIcao = new Set<string>();

  for (const yamlFile of rawSources.openapAircraftYamlFiles) {
    const filename = yamlFile.filename;
    const typeCode = filename.replace(".yml", "").toLowerCase();
    const rawIcao = typeCode.toUpperCase();

    let yml: any = null;
    try {
      yml = yaml.load(yamlFile.content);
    } catch (e) {
      issues.warn("aircraft-type", `aircraft-type:${rawIcao}`, `Failed to parse YAML file ${filename}: ${String(e)}`);
      continue;
    }

    if (!yml) {
      continue;
    }

    const seatCapacity = yml.pax?.max ?? yml.pax?.high ?? yml.pax?.std;
    if (!seatCapacity || seatCapacity < 20) {
      continue;
    }

    let rangeKm = 0;
    if (yml.cruise?.range) {
      rangeKm = Number(yml.cruise.range);
    } else if (yml.range) {
      rangeKm = Number(yml.range);
    }
    if (!rangeKm || rangeKm < 500) {
      continue;
    }

    let cruisingSpeedKph = 0;
    if (yml.cruise?.mach && yml.cruise?.height) {
      const h = Number(yml.cruise.height);
      const mach = Number(yml.cruise.mach);
      const T0 = 288.15;
      const L = 0.0065;
      let T = T0 - L * h;
      if (h > 11000) {
        T = 216.65;
      }
      const a = Math.sqrt(1.4 * 287.05 * T);
      const tasMs = mach * a;
      cruisingSpeedKph = Math.round(tasMs * 3.6);
    } else if (yml.cruise?.speed) {
      cruisingSpeedKph = Math.round(Number(yml.cruise.speed) * 3.6);
    } else if (yml.vmo) {
      cruisingSpeedKph = Math.round(Number(yml.vmo) * 3.6 * 0.8);
    }
    if (!cruisingSpeedKph || cruisingSpeedKph < 250) {
      continue;
    }

    const mtowKg = Number(yml.mass?.max ?? yml.mass?.mtow ?? yml.mass?.std ?? yml.mtow ?? 60000);
    if (mtowKg < 5000) {
      continue;
    }

    let minRunwayLength = Number(yml.runway?.length ?? yml.runway ?? 0);
    if (!minRunwayLength) {
      if (mtowKg > 150000) {
        minRunwayLength = 2500;
      } else if (mtowKg > 50000) {
        minRunwayLength = 1800;
      } else {
        minRunwayLength = 1400;
      }
    }
    if (minRunwayLength < 500) {
      continue;
    }

    const rawName = String(yml.aircraft ?? icaoToName.get(rawIcao) ?? rawIcao).trim();
    const { manufacturer, model } = parseManModel(rawName);
    const manufacturerId = resolveManufacturerId(manufacturer);

    const isTurboprop =
      cruisingSpeedKph < 600 ||
      rawName.toLowerCase().includes("atr") ||
      rawName.toLowerCase().includes("q400") ||
      rawName.toLowerCase().includes("dash");

    const fuelConsumption = Math.round(mtowKg * (isTurboprop ? 0.03 : 0.06));
    if (fuelConsumption <= 0) {
      continue;
    }

    const pricePerUnit = Math.round(
      seatCapacity * (seatCapacity >= 250 ? 900000 : seatCapacity >= 100 ? 600000 : 400000),
    );
    const maintCostPerFlightHour = Math.max(100, Math.round(fuelConsumption * 0.5));

    const icao = rawIcao;
    const iata = icaoToIata.get(icao) ?? fallbackIataCode(icao);

    if (!/^[A-Z0-9]{2,3}$/u.test(iata)) {
      continue;
    }

    if (seenIcao.has(icao)) {
      continue;
    }
    seenIcao.add(icao);

    const characteristics = JSON.stringify({
      category: seatCapacity >= 300 ? "widebody" : seatCapacity >= 100 ? "narrowbody" : "regional",
      engines: resolveEngines(yml.engine, enginesMap),
      fuel_model: fuelModels.get(typeCode) ?? fuelModels.get("default") ?? { c1: 0.1, c2: 0.2, c3: 0.3 },
      rangeClass: rangeKm >= 10000 ? "long-haul" : rangeKm >= 4500 ? "medium-haul" : "regional",
      realWorldMetadata: {
        manufacturer,
        model,
        source: "OpenAP / OpenFlights",
      },
      runwayClass: minRunwayLength >= 2400 ? "long" : minRunwayLength >= 1400 ? "medium" : "short",
      source: "openap",
      specs: yml,
    });

    const payload: AircraftTypePayload = {
      base_maintenance_points: Math.max(8000, Math.round(maintCostPerFlightHour * 5)),
      base_turnaround_points: Math.max(20, Math.round(seatCapacity / 6)),
      characteristics,
      cruising_speed_kph: cruisingSpeedKph,
      d_check_interval_fh: 24000,
      d_check_interval_years: 6,
      d_check_overdue_multiplier: 1.35,
      fuel_consumption_per_hour: fuelConsumption,
      iata_code: iata,
      icao_code: icao,
      image_upload_id: "",
      maint_cost_per_flight_hour: maintCostPerFlightHour,
      maint_cost_per_landing: Math.round(maintCostPerFlightHour * 0.8),
      maint_cost_per_takeoff: Math.round(maintCostPerFlightHour * 0.9),
      manufacturer_id: manufacturerId,
      max_planned_seat_capacity: seatCapacity,
      max_range_km: rangeKm,
      min_runway_length_m: minRunwayLength,
      model_name: `${manufacturer} ${model}`.trim(),
      mtow_kg: mtowKg,
      price_per_unit: pricePerUnit,
      production_points_price: Math.max(100, Math.round(pricePerUnit / 50000)),
    };

    const finalPayload = applyOverride(payload, overrides);
    payloads.push(finalPayload);
  }

  const withImages = await enrichAircraftImages(payloads, options, issues);
  const deduplicated = deduplicateIataCodes(withImages, issues);

  return deduplicated.map((payload) => ({
    payload,
    sourceKey: sourceKeyFor(payload),
  }));
}

function resolveEngines(engineYml: any, enginesMap: Map<string, any>): any[] {
  if (!engineYml) {
    return [];
  }
  const engineOptionsStr = engineYml.options ?? {};
  const engineDefault = engineYml.default;

  let engineNames: string[] = [];
  if (engineOptionsStr && typeof engineOptionsStr === "object") {
    engineNames = Object.values(engineOptionsStr);
  } else if (Array.isArray(engineOptionsStr)) {
    engineNames = engineOptionsStr;
  }
  if (engineDefault && !engineNames.includes(engineDefault)) {
    engineNames.push(engineDefault);
  }

  return engineNames.map((name) => {
    const spec = enginesMap.get(name);
    return spec ? spec : { missing: true, name };
  });
}

function resolveManufacturerId(manufacturerName: string): string {
  const normalized = manufacturerName.toLowerCase();
  if (normalized.includes("airbus")) {
    return SEEDED_MANUFACTURER_IDS.Airbus;
  }
  if (normalized.includes("boeing") || normalized.includes("douglas") || normalized.includes("mcdonnell")) {
    return SEEDED_MANUFACTURER_IDS.Boeing;
  }
  if (normalized.includes("embraer")) {
    return SEEDED_MANUFACTURER_IDS.Embraer;
  }
  if (normalized.includes("atr") || normalized.includes("avions de transport")) {
    return SEEDED_MANUFACTURER_IDS.ATR;
  }
  return SEEDED_MANUFACTURER_IDS.Boeing;
}

function parseManModel(raw: string): { manufacturer: string; model: string } {
  const parts = raw.split(" ");
  let manufacturer = parts[0] ?? "Unknown";
  let model = parts.slice(1).join(" ");

  if (raw.startsWith("McDonnell Douglas")) {
    manufacturer = "McDonnell Douglas";
    model = raw.substring("McDonnell Douglas".length).trim();
  } else if (raw.startsWith("De Havilland")) {
    manufacturer = "De Havilland";
    model = raw.substring("De Havilland".length).trim();
  }

  if (!model) {
    model = raw;
    manufacturer = "Unknown";
  }

  return { manufacturer, model };
}

function fallbackIataCode(icao: string): string {
  return icao.length >= 3 ? icao.slice(-3).toUpperCase() : icao.toUpperCase();
}

function addImageToCharacteristics(
  payload: AircraftTypePayload,
  image: AircraftVisualImage | undefined,
): AircraftTypePayload {
  if (!image?.imageUrl) {
    return payload;
  }

  try {
    const characteristics = JSON.parse(payload.characteristics) as Record<
      string,
      unknown
    >;
    characteristics.image = image;

    return {
      ...payload,
      characteristics: JSON.stringify(characteristics),
    };
  } catch {
    return payload;
  }
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

  const shouldFetchMissing = false;

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
      "&iiprop=url",
      "&format=json",
    ].join("");

    const text = await fetchCachedWikimediaText(
      cacheFile,
      url,
      options.refreshRaw === true,
    );
    const data = JSON.parse(text) as CommonsImageInfoResponse;
    const page = Object.values(data.query?.pages ?? {})[0];

    return page?.imageinfo?.[0]?.url ?? null;
  } catch (error) {
    issues.warn(
      "aircraft-type",
      sourceKeyFor(payload),
      `Wikimedia Commons fetch failed for "${commonsFile}": ${formatError(error)}`,
    );

    return null;
  }
}

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

async function fetchCachedWikimediaText(
  path: string,
  url: string,
  refreshRaw: boolean,
): Promise<string> {
  if (!refreshRaw) {
    const cached = await readTextIfExists(path);

    if (cached != null) {
      return cached;
    }
  }

  await limitWikimediaRate();

  const response = await fetch(url, {
    headers: { "User-Agent": WIKIMEDIA_USER_AGENT },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${String(response.status)}`);
  }

  const text = await response.text();
  await Bun.write(path, text);

  return text;
}

async function limitWikimediaRate(): Promise<void> {
  const now = Date.now();
  const nextAllowed = lastWikimediaRequestAt + WIKIMEDIA_MIN_DELAY_MS;

  if (now < nextAllowed) {
    await new Promise((resolve) => setTimeout(resolve, nextAllowed - now));
  }

  lastWikimediaRequestAt = Date.now();
}

async function readTextIfExists(path: string): Promise<null | string> {
  const file = Bun.file(path);

  if (!(await file.exists())) {
    return null;
  }

  return await file.text();
}

function aircraftManufacturerName(payload: AircraftTypePayload): string {
  try {
    const characteristics = JSON.parse(payload.characteristics) as Record<
      string,
      unknown
    >;
    const metadata = characteristics.realWorldMetadata as Record<
      string,
      unknown
    >;

    return String(metadata.manufacturer ?? "");
  } catch {
    return "";
  }
}

function aircraftRealWorldModel(payload: AircraftTypePayload): string {
  try {
    const characteristics = JSON.parse(payload.characteristics) as Record<
      string,
      unknown
    >;
    const metadata = characteristics.realWorldMetadata as Record<
      string,
      unknown
    >;

    return String(metadata.model ?? "");
  } catch {
    return "";
  }
}

function normalizeAircraftModelForSearch(
  modelName: string,
  icaoCode: string,
): string {
  let cleaned = modelName
    .replace(/\bNEO\b/iu, "")
    .replace(/\bMAX\b/iu, "")
    .replaceAll(/\s+/gu, " ")
    .trim();

  if (icaoCode.startsWith("A318")) {
    return "Airbus A318";
  }
  if (icaoCode.startsWith("A319")) {
    return "Airbus A319";
  }
  if (icaoCode.startsWith("A320")) {
    return "Airbus A320";
  }
  if (icaoCode.startsWith("A321")) {
    return "Airbus A321";
  }
  if (icaoCode.startsWith("A33")) {
    return "Airbus A330";
  }
  if (icaoCode.startsWith("A34")) {
    return "Airbus A340";
  }
  if (icaoCode.startsWith("A35")) {
    return "Airbus A350";
  }
  if (icaoCode.startsWith("A38")) {
    return "Airbus A380";
  }

  if (icaoCode.startsWith("B73")) {
    return "Boeing 737";
  }
  if (icaoCode.startsWith("B74")) {
    return "Boeing 747";
  }
  if (icaoCode.startsWith("B75")) {
    return "Boeing 757";
  }
  if (icaoCode.startsWith("B76")) {
    return "Boeing 767";
  }
  if (icaoCode.startsWith("B77")) {
    return "Boeing 777";
  }
  if (icaoCode.startsWith("B78")) {
    return "Boeing 787";
  }

  if (icaoCode.startsWith("E17") || icaoCode.startsWith("E170")) {
    return "Embraer 170";
  }
  if (icaoCode.startsWith("E175") || icaoCode.startsWith("E170")) {
    return "Embraer 175";
  }
  if (icaoCode.startsWith("E190")) {
    return "Embraer 190";
  }
  if (icaoCode.startsWith("E195")) {
    return "Embraer 195";
  }

  if (cleaned.includes("AT7") || cleaned.includes("AT72") || cleaned.includes("ATR-72") || cleaned.includes("ATR 72")) {
    return "ATR 72";
  }
  if (cleaned.includes("AT4") || cleaned.includes("AT42") || cleaned.includes("ATR-42") || cleaned.includes("ATR 42")) {
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

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
