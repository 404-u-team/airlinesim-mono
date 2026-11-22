import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";

import type { ImportLogInput } from "../src/modules/import/runtime/logger";
import type { SourceIssueSink } from "../src/modules/import/shared/types";

import { loadRestCountries } from "../src/modules/import/runtime/rest-countries";
import { loadWorldBankIndicator } from "../src/modules/import/runtime/world-bank";

const originalFetch = globalThis.fetch;
const originalApiKey = Bun.env.REST_COUNTRIES_API_KEY;
let rawDir: string;

const tourismCsv = [
  '"Data Source","World Development Indicators",',
  "",
  '"Country Name","Country Code","Indicator Name","Indicator Code","2021","2023","2022",',
  '"United States","USA","Tourism","ST.INT.ARVL","10","","20",',
  '"Canada","CAN","Tourism","ST.INT.ARVL","5","0","10",',
  '"Missing","XXX","Tourism","ST.INT.ARVL","","","",',
].join("\r\n");

beforeEach(async () => {
  rawDir = await mkdtemp("/tmp/airlinesim-import-sources-");
});

afterEach(async () => {
  globalThis.fetch = originalFetch;
  if (originalApiKey === undefined) {
    delete Bun.env.REST_COUNTRIES_API_KEY;
  } else {
    Bun.env.REST_COUNTRIES_API_KEY = originalApiKey;
  }
  await rm(rawDir, { force: true, recursive: true });
});

function issues(warnings: string[]): SourceIssueSink {
  return {
    error() {},
    skip() {},
    warn(_entity, _key, message) { warnings.push(message); },
  };
}

test("World Bank uses the newest non-empty observation per country and preserves zero", async () => {
  const warnings: string[] = [];
  await Bun.write(`${rawDir}/worldbank-tourism.csv`, tourismCsv);

  const values = await loadWorldBankIndicator(rawDir, "tourism", false, issues(warnings));

  expect([...values]).toEqual([["USA", 20], ["CAN", 0]]);
  expect(warnings).toEqual([]);
});

test("World Bank retries 502 from the CSV endpoint and keeps the last valid cache", async () => {
  const logs: ImportLogInput[] = [];
  const urls: string[] = [];
  globalThis.fetch = async (url) => {
    urls.push(String(url));
    return new Response(null, { status: 502 });
  };
  const path = `${rawDir}/worldbank-tourism.csv`;
  await Bun.write(path, tourismCsv);

  const values = await loadWorldBankIndicator(rawDir, "tourism", true, issues([]), (entry) => logs.push(entry));

  expect(urls).toEqual(Array.from({ length: 3 }, () => "https://api.worldbank.org/v2/en/indicator/ST.INT.ARVL?downloadformat=csv"));
  expect(values.get("USA")).toBe(20);
  expect(await Bun.file(path).text()).toBe(tourismCsv);
  expect(logs.at(-1)?.message).toBe("Source refresh failed, using cached data");
});

test("World Bank ignores an invalid archive response and falls back to legacy data or estimates", async () => {
  const warnings: string[] = [];
  globalThis.fetch = async () => Response.json({ message: "Temporarily unavailable" });
  await Bun.write(`${rawDir}/worldbank-gdp.json`, JSON.stringify([{}, [{ countryiso3code: "USA", value: 100 }]]));

  const gdp = await loadWorldBankIndicator(rawDir, "gdp", false, issues(warnings));
  const tourism = await loadWorldBankIndicator(rawDir, "tourism", false, issues(warnings));

  expect(gdp.get("USA")).toBe(100);
  expect(tourism.size).toBe(0);
  expect(warnings[0]).toContain("Using cached World Bank JSON");
  expect(warnings[1]).toContain("Using estimates for missing values");
  expect(await Bun.file(`${rawDir}/worldbank-gdp.csv`).exists()).toBe(false);
});

test("REST Countries replaces an invalid cache and handles a rejected API key via the public dataset", async () => {
  Bun.env.REST_COUNTRIES_API_KEY = "test-key";
  const urls: string[] = [];
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    urls.push(url.hostname);
    if (url.hostname === "api.restcountries.com") {
      expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer test-key");
      return new Response(null, { status: 401 });
    }
    expect(new Headers(init?.headers).has("Authorization")).toBe(false);
    return Response.json([{ cca2: "TR", cca3: "TUR", name: { common: "Türkiye", native: { tur: { common: "Türkiye" } } } }]);
  };
  await Bun.write(`${rawDir}/rest-countries.json`, "{ broken json");

  const countries = await loadRestCountries(rawDir, false);

  expect(countries[0]?.name?.nativeName?.tur?.common).toBe("Türkiye");
  expect(urls).toEqual(["api.restcountries.com", "raw.githubusercontent.com"]);
  expect(await Bun.file(`${rawDir}/rest-countries.json`).json()).toEqual([
    { cca2: "TR", cca3: "TUR", name: { common: "Türkiye", native: { tur: { common: "Türkiye" } } } },
  ]);
});

test("REST Countries v5 follows pagination and normalizes the current response fields", async () => {
  Bun.env.REST_COUNTRIES_API_KEY = "test-key";
  const offsets: string[] = [];
  globalThis.fetch = async (input) => {
    const url = new URL(String(input));
    expect(url.hostname).toBe("api.restcountries.com");
    const offset = url.searchParams.get("offset") ?? "";
    offsets.push(offset);
    const firstPage = offset === "0";
    const country = firstPage ? {
      capitals: [{ name: "Ankara" }],
      codes: { alpha_2: "TR", alpha_3: "TUR" },
      coordinates: { lat: 39, lng: 35 },
      names: { common: "Türkiye", translations: { eng: { common: "Turkey" } } },
    } : { codes: { alpha_2: "CA", alpha_3: "CAN" }, names: { common: "Canada" } };
    return Response.json({ data: { meta: { more: firstPage, total: 2 }, objects: [country] } });
  };

  const countries = await loadRestCountries(rawDir, true);

  expect(offsets).toEqual(["0", "1"]);
  expect(countries.map((country) => country.cca2)).toEqual(["TR", "CA"]);
  expect(countries[0]).toMatchObject({
    capital: ["Ankara"],
    latlng: [39, 35],
    translations: { eng: { common: "Turkey" } },
  });
  expect(await loadRestCountries(rawDir, false)).toEqual(countries);
  expect(offsets).toEqual(["0", "1"]);
});
