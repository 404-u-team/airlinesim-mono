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

// Maps an aircraft model/ICAO to a canonical Wikipedia page title / search term.
// Ported from the previous in-import enrichment so behaviour is preserved.
export function normalizeAircraftModelForSearch(modelName: string, icaoCode: string): string {
  const text = `${modelName} ${icaoCode}`.toUpperCase();

  if (text.includes("A220") || text.includes("BCS")) {return "Airbus A220";}
  if (text.includes("A19N") || text.includes("A20N") || text.includes("A21N") || text.includes("A320NEO")) {
    return "Airbus A320neo family";
  }
  if (text.includes("A318") || text.includes("A319") || text.includes("A320") || text.includes("A321")) {
    return "Airbus A320 family";
  }
  if (text.includes("A330")) {return "Airbus A330";}
  if (text.includes("A340")) {return "Airbus A340";}
  if (text.includes("A350")) {return "Airbus A350";}
  if (text.includes("A380") || icaoCode === "A388") {return "Airbus A380";}

  if (text.includes("B38") || text.includes("B39") || text.includes("737 MAX")) {return "Boeing 737 MAX";}
  if (text.includes("B737") || text.includes("B738") || text.includes("B739") || text.includes("737")) {
    return "Boeing 737";
  }
  if (text.includes("B747") || text.includes("747")) {return "Boeing 747";}
  if (text.includes("B757") || text.includes("757")) {return "Boeing 757";}
  if (text.includes("B767") || text.includes("767")) {return "Boeing 767";}
  if (text.includes("B777") || text.includes("B77") || text.includes("777")) {return "Boeing 777";}
  if (text.includes("B787") || text.includes("B78") || text.includes("787")) {return "Boeing 787 Dreamliner";}

  if (text.includes("E190") || text.includes("E195") || text.includes("E290") || text.includes("E295")) {
    return "Embraer E-Jet E2 family";
  }
  if (text.includes("E170") || text.includes("E175")) {return "Embraer E-Jet family";}

  if (text.includes("ATR") || text.includes("AT7") || text.includes("AT72")) {return "ATR 72";}
  if (text.includes("AT4") || text.includes("AT42")) {return "ATR 42";}

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
    const entity = data.entities?.[qid];
    const commonsFile = entity?.claims?.P18?.[0]?.mainsnak?.datavalue?.value;

    if (!commonsFile) {
      return null;
    }

    const imageUrl = await fetchCommonsImageUrl(commonsFile);

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
  } catch {
    return null;
  }
}

async function fetchWikidataAircraftImage(
  input: AircraftImageInput,
): Promise<AircraftVisualImage | null> {
  for (const query of wikidataQueriesForAircraft(input)) {
    const qids = await searchWikidataAircraft(query);

    for (const qid of qids.slice(0, WIKIDATA_QIDS_TO_CHECK)) {
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
    await waitForWikimediaThrottle();

    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "Api-User-Agent": WIKIMEDIA_USER_AGENT,
        "User-Agent": WIKIMEDIA_USER_AGENT,
      },
    });

    if (response.ok) {
      return (await response.json()) as TValue;
    }

    if (response.status === 429 || response.status === 503) {
      const retryAfterMs = retryAfterToMs(response.headers.get("retry-after"));
      const backoffMs = retryAfterMs ?? Math.min(60_000, 2_000 * 2 ** attempt);

      lastError = new Error(`${response.status} ${response.statusText}; retrying after ${backoffMs}ms`);
      await sleep(backoffMs);
      continue;
    }

    throw new Error(`${response.status} ${response.statusText}`);
  }

  throw lastError instanceof Error ? lastError : new Error("Wikimedia request failed after retries");
}

async function fetchWikipediaSummaryImage(
  input: AircraftImageInput,
): Promise<AircraftVisualImage | null> {
  for (const title of wikipediaTitlesForAircraft(input)) {
    try {
      const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
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
      `&limit=${WIKIDATA_SEARCH_LIMIT}`,
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
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

async function waitForWikimediaThrottle(): Promise<void> {
  const waitMs = Math.max(0, WIKIMEDIA_MIN_DELAY_MS - (Date.now() - lastWikimediaRequestAt));

  if (waitMs > 0) {
    await sleep(waitMs);
  }

  lastWikimediaRequestAt = Date.now();
}

function wikidataAircraftSearchScore(item: { description?: string; label?: string }): number {
  const text = `${item.label ?? ""} ${item.description ?? ""}`.toLowerCase();
  let score = 0;

  if (text.includes("aircraft")) {score += 10;}
  if (text.includes("airliner")) {score += 10;}
  if (text.includes("airplane")) {score += 8;}
  if (text.includes("jet")) {score += 4;}
  if (text.includes("turboprop")) {score += 4;}
  if (text.includes("narrow-body") || text.includes("wide-body")) {score += 3;}
  if (text.includes("family")) {score += 2;}
  if (text.includes("airport")) {score -= 15;}
  if (text.includes("airline")) {score -= 12;}
  if (text.includes("accident") || text.includes("incident") || text.includes("crash")) {score -= 12;}
  if (text.includes("flight ")) {score -= 8;}

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
