import type { ImportLogger } from "./logger";

import { loadJsonArray } from "./storage";

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

// Сырая строка датасета mledoze/countries: то же содержимое, что отдавал
// REST Countries v3.1 (датасет и был его первоисточником), но native-имена
// лежат в `name.native`, а популяция отсутствует (основной источник - World Bank).
type MledozeCountry = Omit<RestCountry, "name"> & {
  name?: { common?: string; native?: Record<string, { common?: string }> };
};

// Строка REST Countries v5 (https://api.restcountries.com/countries/v5):
// JSON:API-формат с переименованными полями относительно v3.1.
type RestCountriesV5Row = {
  area?: { kilometers?: number };
  borders?: string[];
  capital?: string[];
  codes?: { alpha_2?: string; alpha_3?: string };
  landlocked?: boolean;
  languages?: unknown;
  names?: { common?: string; native?: Record<string, { common?: string }> };
  population?: number;
  region?: string;
  subregion?: string;
};

type RestCountriesV5Page = {
  data?: {
    meta?: { more?: boolean };
    objects?: RestCountriesV5Row[];
  };
};

// REST Countries v3.1 закрыт. Основной источник стран - v5 API с ключом из
// REST_COUNTRIES_API_KEY; без ключа используется первоисточник того же
// датасета - статический mledoze/countries.
const FALLBACK_URL = "https://raw.githubusercontent.com/mledoze/countries/master/countries.json";
const V5_URL = "https://api.restcountries.com/countries/v5";

export async function loadRestCountries(rawDir: string, refreshRaw: boolean, log?: ImportLogger): Promise<RestCountry[]> {
  const apiKey = (Bun.env.REST_COUNTRIES_API_KEY ?? "").trim();

  if (apiKey) {
    return loadRestCountriesV5(`${rawDir}/rest-countries-v5.json`, apiKey, refreshRaw, log);
  }

  log?.({
    level: "info",
    message: "REST_COUNTRIES_API_KEY is not set, using mledoze/countries dataset",
    operation: "source.fetch",
    stage: "building",
  });
  const rows = await loadJsonArray<MledozeCountry>(`${rawDir}/rest-countries.json`, FALLBACK_URL, refreshRaw, log);

  return rows.map((country) => ({
    ...country,
    name: { common: country.name?.common, nativeName: country.name?.native },
  }));
}

export function indexRestCountries(rows: RestCountry[]): Map<string, RestCountry> {
  return new Map(rows.filter((country) => country.cca2).map((country) => [country.cca2 ?? "", country]));
}

// Кэш хранит уже приведенные к RestCountry строки, чтобы смена схемы v5 не
// требовала повторной миграции старых кэшей.
async function loadRestCountriesV5(path: string, apiKey: string, refreshRaw: boolean, log?: ImportLogger): Promise<RestCountry[]> {
  if (!refreshRaw) {
    const cached = await readCachedRestCountries(path, log);
    if (cached) {
      return cached;
    }
  }

  const rows: RestCountriesV5Row[] = [];
  const pageLimit = 100;

  for (let offset = 0; ; offset += pageLimit) {
    const url = `${V5_URL}?limit=${String(pageLimit)}&offset=${String(offset)}`;
    log?.({ details: { url }, level: "info", message: "Downloading import source", operation: "source.fetch", stage: "building" });
    const response = await fetch(url, { headers: { Authorization: `Bearer ${apiKey}` } });

    if (!response.ok) {
      throw new Error(`Failed to fetch ${url}: ${String(response.status)}`);
    }

    const payload = (await response.json()) as RestCountriesV5Page;
    const page = payload.data?.objects;

    if (!Array.isArray(page)) {
      throw new Error(`REST Countries v5 returned unexpected payload: ${JSON.stringify(payload).slice(0, 200)}`);
    }

    rows.push(...page);

    if (page.length === 0 || payload.data?.meta?.more !== true) {
      break;
    }
  }

  const mapped = rows.map(mapV5Country);
  await Bun.write(path, JSON.stringify(mapped));

  return mapped;
}

async function readCachedRestCountries(path: string, log?: ImportLogger): Promise<null | RestCountry[]> {
  const file = Bun.file(path);

  if (!(await file.exists())) {
    return null;
  }

  const cached = JSON.parse(await file.text()) as unknown;

  if (!Array.isArray(cached)) {
    return null;
  }

  log?.({ details: { path }, level: "info", message: "Using cached source", operation: "source.cache", stage: "building" });

  return cached as RestCountry[];
}

function mapV5Country(row: RestCountriesV5Row): RestCountry {
  return {
    area: row.area?.kilometers,
    borders: row.borders,
    capital: row.capital,
    cca2: row.codes?.alpha_2,
    cca3: row.codes?.alpha_3,
    landlocked: row.landlocked,
    languages: v5Languages(row.languages),
    name: { common: row.names?.common, nativeName: row.names?.native },
    population: row.population,
    region: row.region,
    subregion: row.subregion,
  };
}

// v5 отдает языки массивом объектов; downstream-коду нужен Record как в v3.1.
function v5Languages(languages: unknown): Record<string, string> {
  if (!Array.isArray(languages)) {
    return languages && typeof languages === "object" ? (languages as Record<string, string>) : {};
  }

  const entries = languages.map((language, index): [string, string] => {
    if (typeof language === "string") {
      return [String(index), language];
    }

    const record = language as Record<string, unknown>;
    const code = typeof record.code === "string" ? record.code : String(index);

    return [code, v5LanguageName(record)];
  });

  return Object.fromEntries(entries.filter(([, name]) => name));
}

function v5LanguageName(record: Record<string, unknown>): string {
  if (typeof record.name === "string") {
    return record.name;
  }

  return typeof record.common === "string" ? record.common : "";
}
