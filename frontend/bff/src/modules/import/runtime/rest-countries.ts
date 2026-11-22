import { errorDetails, type ImportLogger } from "./logger";
import { fetchSource, loadCachedSource, loadCachedText } from "./source-fetch";

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
  name?: NonNullable<RestCountry["name"]> & { native?: RestCountryNameMap };
};

type RestCountryNameMap = Record<string, { common?: string }>;

// Строка REST Countries v5 (https://api.restcountries.com/countries/v5):
// JSON:API-формат с переименованными полями относительно v3.1.
type RestCountriesV5Row = {
  area?: { kilometers?: number };
  borders?: string[];
  capitals?: Array<{ name: string }>;
  codes?: { alpha_2?: string; alpha_3?: string };
  coordinates?: { lat?: number; lng?: number };
  landlocked?: boolean;
  languages?: unknown;
  names?: { common?: string; native?: RestCountryNameMap; translations?: RestCountryNameMap };
  population?: number;
  region?: string;
  subregion?: string;
};

type RestCountriesV5Page = {
  data?: {
    meta?: { more?: boolean; total?: number };
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
    try {
      const path = `${rawDir}/rest-countries-v5.json`;
      return await loadCachedSource(path, refreshRaw, parseCountries, async () => downloadV5Countries(path, apiKey, log), log);
    } catch (error) {
      log?.({
        details: errorDetails(error),
        level: "warning",
        message: "REST Countries v5 is unavailable, using mledoze/countries dataset",
        operation: "source.fetch",
        stage: "building",
      });
    }
  }

  const rows = await loadCachedText(`${rawDir}/rest-countries.json`, FALLBACK_URL, refreshRaw, parseCountries, log);

  return rows.map((country) => ({
    ...country,
    name: { common: country.name?.common, nativeName: country.name?.native ?? country.name?.nativeName },
  }));
}

export function indexRestCountries(rows: RestCountry[]): Map<string, RestCountry> {
  return new Map(rows.filter((country) => country.cca2).map((country) => [country.cca2 ?? "", country]));
}

// Кэш хранит уже приведенные к RestCountry строки, чтобы смена схемы v5 не
// требовала повторной миграции старых кэшей.
async function downloadV5Countries(path: string, apiKey: string, log?: ImportLogger): Promise<string> {
  const rows: RestCountriesV5Row[] = [];
  const headers = { Authorization: `Bearer ${apiKey}` };
  const pageLimit = 100;

  for (;;) {
    const url = `${V5_URL}?limit=${String(pageLimit)}&offset=${String(rows.length)}`;
    const payload = await fetchSource(url, path, async (response) => (await response.json()) as RestCountriesV5Page, log, headers);
    const { meta, objects } = payload.data ?? {};
    if (!Array.isArray(objects) || objects.length === 0 || typeof meta?.total !== "number" || typeof meta.more !== "boolean") {
      throw new Error("REST Countries v5 returned invalid pagination data");
    }
    rows.push(...objects);
    if (rows.length > meta.total || meta.more !== (rows.length < meta.total)) {
      throw new Error("REST Countries v5 returned an incomplete dataset");
    }
    if (!meta.more) {
      return JSON.stringify(rows.map(mapV5Country));
    }
  }
}

function parseCountries(text: string): MledozeCountry[] {
  const rows = JSON.parse(text) as unknown;
  if (!Array.isArray(rows) || rows.length === 0 || !rows.every(isCountry)) {
    throw new Error("Invalid countries dataset");
  }
  if (new Set(rows.map((country) => country.cca2)).size !== rows.length) {
    throw new Error("Duplicate country codes in the countries dataset");
  }
  return rows;
}

function isCountry(value: unknown): value is MledozeCountry {
  const country = value as MledozeCountry | null;
  return Boolean(country?.cca2 && country.cca3 && country.name?.common);
}

function mapV5Country(row: RestCountriesV5Row): RestCountry {
  return {
    area: row.area?.kilometers,
    borders: row.borders,
    capital: row.capitals?.map((capital) => capital.name),
    cca2: row.codes?.alpha_2,
    cca3: row.codes?.alpha_3,
    landlocked: row.landlocked,
    languages: v5Languages(row.languages),
    latlng: typeof row.coordinates?.lat === "number" && typeof row.coordinates.lng === "number"
      ? [row.coordinates.lat, row.coordinates.lng]
      : undefined,
    name: { common: row.names?.common, nativeName: row.names?.native },
    population: row.population,
    region: row.region,
    subregion: row.subregion,
    translations: row.names?.translations,
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

    const record = (language ?? {}) as Record<string, unknown>;
    const code = record.iso639_3 ?? record.code;

    return [typeof code === "string" ? code : String(index), v5LanguageName(record)];
  });

  return Object.fromEntries(entries.filter(([, name]) => name));
}

function v5LanguageName(record: Record<string, unknown>): string {
  if (typeof record.name === "string") {
    return record.name;
  }

  return typeof record.common === "string" ? record.common : "";
}
