import type { AircraftVisualImage } from "./storage";

// Resolves a representative photo for an aircraft type.
//
// Primary source: Wikipedia REST `page/summary/{title}` — returns the lead
// image (`originalimage`/`thumbnail`) in a SINGLE request. Aircraft model names
// are normalized to canonical Wikipedia page titles (e.g. "Airbus A320 family",
// "Boeing 787 Dreamliner"), so this resolves most types in one hop.
//
// Fallback: the classic Wikidata search -> entity (P18) -> Commons imageinfo
// chain, kept for types whose normalized title does not map to a page.
//
// All requests go through a shared throttle + retry/backoff so a full refresh
// of ~80 types stays well under Wikimedia's per-IP rate limit (avoids the 429s
// that made the previous in-import fetch unusable).

export type AircraftImageInput = {
  characteristics?: string;
  icaoCode: string;
  modelName: string;
};

type CommonsImageInfoResponse = {
  query?: {
    pages?: Record<string, { imageinfo?: Array<{ url?: string }> }>;
  };
};

type WikidataEntity = NonNullable<NonNullable<WikidataEntityResponse["entities"]>[string]>;

type WikidataEntityResponse = {
  entities?: Record<
    string,
    {
      claims?: { P18?: Array<{ mainsnak?: { datavalue?: { value?: string } } }> };
      labels?: { en?: { value?: string } };
      sitelinks?: { enwiki?: { title?: string; url?: string } };
    }
  >;
};

type WikidataSearchResponse = {
  search?: Array<{ description?: string; id?: string; label?: string }>;
};

type WikipediaSummaryResponse = {
  content_urls?: { desktop?: { page?: string } };
  originalimage?: { source?: string };
  thumbnail?: { source?: string };
  title?: string;
};

const WIKIMEDIA_USER_AGENT = "AirlineSim-Import-Agent/1.0";
const WIKIMEDIA_MIN_DELAY_MS = 350;
const WIKIMEDIA_MAX_RETRIES = 4;
const WIKIDATA_SEARCH_LIMIT = 3;
const WIKIDATA_QIDS_TO_CHECK = 2;

let lastWikimediaRequestAt = 0;

export async function fetchAircraftVisualImage(
  input: AircraftImageInput,
): Promise<AircraftVisualImage | null> {
  const fromWikipedia = await fetchWikipediaSummaryImage(input);

  if (fromWikipedia) {
    return fromWikipedia;
  }

  return fetchWikidataAircraftImage(input);
}

const NORMALIZE_RULES = [
  { target: "Airbus A220", triggers: ["A220", "BCS"] },
  { target: "Airbus A320neo family", triggers: ["A19N", "A20N", "A21N", "A320NEO"] },
  { target: "Airbus A320 family", triggers: ["A318", "A319", "A320", "A321"] },
  { target: "Airbus A330", triggers: ["A330"] },
  { target: "Airbus A340", triggers: ["A340"] },
  { target: "Airbus A350", triggers: ["A350"] },
  { target: "Airbus A380", triggers: ["A380", "A388"] },
  { target: "Boeing 737 MAX", triggers: ["B38", "B39", "737 MAX"] },
  { target: "Boeing 737", triggers: ["B737", "B738", "B739", "737"] },
  { target: "Boeing 747", triggers: ["B747", "747"] },
  { target: "Boeing 757", triggers: ["B757", "757"] },
  { target: "Boeing 767", triggers: ["B767", "767"] },
  { target: "Boeing 777", triggers: ["B777", "B77", "777"] },
  { target: "Boeing 787 Dreamliner", triggers: ["B787", "B78", "787"] },
  { target: "Embraer E-Jet E2 family", triggers: ["E190", "E195", "E290", "E295"] },
  { target: "Embraer E-Jet family", triggers: ["E170", "E175"] },
  { target: "ATR 72", triggers: ["ATR", "AT7", "AT72"] },
  { target: "ATR 42", triggers: ["AT4", "AT42"] },
];

// Maps an aircraft model/ICAO to a canonical Wikipedia page title / search term.
// Ported from the previous in-import enrichment so behaviour is preserved.
export function normalizeAircraftModelForSearch(modelName: string, icaoCode: string): string {
  const text = `${modelName} ${icaoCode}`.toUpperCase();

  for (const rule of NORMALIZE_RULES) {
    if (rule.triggers.some((trigger) => text.includes(trigger))) {
      return rule.target;
    }
  }

  return modelName;
}

async function fetchCommonsImageUrl(commonsFile: string): Promise<null | string> {
  try {
    const url = [
      "https://commons.wikimedia.org/w/api.php",
      "?action=query",
      `&titles=File:${encodeURIComponent(commonsFile)}`,
      "&prop=imageinfo",
      "&iiprop=url|mime",
      "&format=json",
    ].join("");
    const data = await fetchWikimediaJson<CommonsImageInfoResponse>(url);
    const pages = data.query?.pages ?? {};
    const firstPage = Object.values(pages)[0];

    return firstPage?.imageinfo?.[0]?.url ?? null;
  } catch {
    return null;
  }
}

async function fetchWikidataAircraftDetails(
  qid: string,
  searchQuery: string,
): Promise<AircraftVisualImage | null> {
  try {
    const url = `https://www.wikidata.org/wiki/Special:EntityData/${qid}.json`;
    const data = await fetchWikimediaJson<WikidataEntityResponse>(url);
    const { entities } = data;
    if (!entities) {
      return null;
    }
    const entity = entities[qid];
    if (!entity) {
      return null;
    }

    const commonsFile = getCommonsFileFromEntity(entity);

    if (!commonsFile) {
      return null;
    }

    const imageUrl = await fetchCommonsImageUrl(commonsFile);

    if (!imageUrl) {
      return null;
    }

    const { pageUrl, title } = getEntityMetadata(entity);

    return {
      commonsFile,
      imageUrl,
      pageUrl,
      qid,
      searchQuery,
      source: "Wikidata/Wikimedia Commons",
      title,
    };
  } catch {
    return null;
  }
}

async function fetchWikidataAircraftImage(
  input: AircraftImageInput,
): Promise<AircraftVisualImage | null> {
  for (const query of wikidataQueriesForAircraft(input)) {
    // eslint-disable-next-line no-await-in-loop
    const qids = await searchWikidataAircraft(query);

    for (const qid of qids.slice(0, WIKIDATA_QIDS_TO_CHECK)) {
      // eslint-disable-next-line no-await-in-loop
      const details = await fetchWikidataAircraftDetails(qid, query);

      if (details?.imageUrl) {
        return details;
      }
    }
  }

  return null;
}

async function fetchWikimediaJson<TValue>(url: string): Promise<TValue> {
  let lastError: unknown = null;

  for (let attempt = 0; attempt <= WIKIMEDIA_MAX_RETRIES; attempt++) {
    // eslint-disable-next-line no-await-in-loop
    await waitForWikimediaThrottle();

    // eslint-disable-next-line no-await-in-loop
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "Api-User-Agent": WIKIMEDIA_USER_AGENT,
        "User-Agent": WIKIMEDIA_USER_AGENT,
      },
    });

    if (response.ok) {
      // eslint-disable-next-line no-await-in-loop
      return (await response.json()) as TValue;
    }

    if (response.status === 429 || response.status === 503) {
      const retryAfterMs = retryAfterToMs(response.headers.get("retry-after"));
      const backoffMs = retryAfterMs ?? Math.min(60_000, 2_000 * 2 ** attempt);

      lastError = new Error(`${String(response.status)} ${response.statusText}; retrying after ${String(backoffMs)}ms`);
      // eslint-disable-next-line no-await-in-loop
      await sleep(backoffMs);
      continue;
    }

    throw new Error(`${String(response.status)} ${response.statusText}`);
  }

  throw lastError instanceof Error ? lastError : new Error("Wikimedia request failed after retries");
}

async function fetchWikipediaSummaryImage(
  input: AircraftImageInput,
): Promise<AircraftVisualImage | null> {
  for (const title of wikipediaTitlesForAircraft(input)) {
    try {
      const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
      // eslint-disable-next-line no-await-in-loop
      const response = await fetchWikimediaJson<WikipediaSummaryResponse>(url);
      const imageUrl = response.originalimage?.source ?? response.thumbnail?.source;

      if (imageUrl) {
        return {
          imageUrl,
          pageUrl: response.content_urls?.desktop?.page,
          searchQuery: title,
          source: "Wikipedia",
          title: response.title ?? title,
        };
      }
    } catch {
      // Try the next title candidate.
    }
  }

  return null;
}

function getCommonsFileFromEntity(entity: WikidataEntity): null | string {
  return entity.claims?.P18?.[0]?.mainsnak?.datavalue?.value ?? null;
}

function getEntityMetadata(entity: WikidataEntity): { pageUrl?: string; title?: string } {
  const enwiki = entity.sitelinks?.enwiki;
  const pageUrl = enwiki?.url;
  const title = entity.labels?.en?.value ?? enwiki?.title;
  return { pageUrl, title };
}

function realWorldMetadata(characteristics?: string): {
  manufacturer: string;
  model: string;
} {
  try {
    const parsed = JSON.parse(characteristics ?? "{}") as {
      realWorldMetadata?: { manufacturer?: unknown; model?: unknown };
    };
    const metadata = parsed.realWorldMetadata;

    return {
      manufacturer: typeof metadata?.manufacturer === "string" ? metadata.manufacturer : "",
      model: typeof metadata?.model === "string" ? metadata.model : "",
    };
  } catch {
    return { manufacturer: "", model: "" };
  }
}

function retryAfterToMs(value: null | string): null | number {
  if (!value) {
    return null;
  }

  const seconds = Number(value);

  if (Number.isFinite(seconds)) {
    return Math.max(1_000, seconds * 1_000);
  }

  const dateMs = Date.parse(value);

  return Number.isFinite(dateMs) ? Math.max(1_000, dateMs - Date.now()) : null;
}

async function searchWikidataAircraft(query: string): Promise<string[]> {
  try {
    const url = [
      "https://www.wikidata.org/w/api.php",
      "?action=wbsearchentities",
      `&search=${encodeURIComponent(query)}`,
      "&language=en",
      "&format=json",
      `&limit=${String(WIKIDATA_SEARCH_LIMIT)}`,
    ].join("");
    const data = await fetchWikimediaJson<WikidataSearchResponse>(url);

    return (data.search ?? [])
      .filter((item) => Boolean(item.id))
      .sort((left, right) => wikidataAircraftSearchScore(right) - wikidataAircraftSearchScore(left))
      .map((item) => item.id)
      .filter((id): id is string => Boolean(id));
  } catch {
    return [];
  }
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

async function waitForWikimediaThrottle(): Promise<void> {
  const now = Date.now();
  const waitMs = Math.max(0, WIKIMEDIA_MIN_DELAY_MS - (now - lastWikimediaRequestAt));
  lastWikimediaRequestAt = now + waitMs;

  if (waitMs > 0) {
    await sleep(waitMs);
  }
}

const SCORE_RULES = [
  { trigger: "aircraft", value: 10 },
  { trigger: "airliner", value: 10 },
  { trigger: "airplane", value: 8 },
  { trigger: "jet", value: 4 },
  { trigger: "turboprop", value: 4 },
  { trigger: "family", value: 2 },
  { trigger: "airport", value: -15 },
  { trigger: "airline", value: -12 },
  { trigger: "flight ", value: -8 },
];

const NEGATIVE_TRIGGERS = ["accident", "incident", "crash"];

function wikidataAircraftSearchScore(item: { description?: string; label?: string }): number {
  const text = `${item.label ?? ""} ${item.description ?? ""}`.toLowerCase();
  let score = 0;

  for (const rule of SCORE_RULES) {
    if (text.includes(rule.trigger)) {
      score += rule.value;
    }
  }

  if (text.includes("narrow-body") || text.includes("wide-body")) {
    score += 3;
  }

  if (NEGATIVE_TRIGGERS.some((trigger) => text.includes(trigger))) {
    score -= 12;
  }

  return score;
}

function wikidataQueriesForAircraft(input: AircraftImageInput): string[] {
  const normalized = normalizeAircraftModelForSearch(input.modelName, input.icaoCode);
  const { manufacturer, model } = realWorldMetadata(input.characteristics);

  return uniqueStrings([
    `${normalized} aircraft`,
    normalized,
    manufacturer && model ? `${manufacturer} ${model} aircraft` : "",
    `${input.modelName} aircraft`,
    input.modelName,
    input.icaoCode.toUpperCase(),
  ]);
}

function wikipediaTitlesForAircraft(input: AircraftImageInput): string[] {
  const normalized = normalizeAircraftModelForSearch(input.modelName, input.icaoCode);
  const { manufacturer, model } = realWorldMetadata(input.characteristics);

  return uniqueStrings([
    normalized,
    manufacturer && model ? `${manufacturer} ${model}` : "",
    input.modelName,
  ]);
}
