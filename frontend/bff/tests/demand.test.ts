import { afterEach, expect, test } from "bun:test";

import type { BffConfig } from "../src/config";

import { handleDemandRequest } from "../src/modules/demand";

const config: BffConfig = {
  backendAdminLogin: "admin",
  backendAdminPassword: "password",
  backendBaseUrl: "http://backend.test",
  port: 4200,
};
const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

test("computes airport-pair demand locally without touching region links", async () => {
  const requestedPaths: string[] = [];

  globalThis.fetch = async (input) => {
    const url = String(input);
    requestedPaths.push(url);

    if (url === "http://backend.test/airline/me") {
      return json({ id: "airline-1" });
    }

    if (url === "http://backend.test/auth/login") {
      return json({ access_token: token() });
    }

    if (url === "http://backend.test/airports") {
      return json({
        airports: [
          airport("airport-a", "AAA", "region-a", "POINT(29.000000 41.000000)"),
          airport("airport-b", "BBB", "region-b", "POINT(2.550000 49.010000)"),
        ],
      });
    }

    if (url === "http://backend.test/regions") {
      return json({
        regions: [
          region("region-a", "country-a", 16_000_000, 18_000, 0.75, 0.72),
          region("region-b", "country-b", 12_000_000, 44_000, 0.9, 0.86),
        ],
      });
    }

    return json({ error: "unexpected" }, 500);
  };

  const response = await handleDemandRequest(
    new Request("http://bff.test/demand/airport-pair?origin_airport_id=airport-a&destination_airport_id=airport-b", {
      headers: { Authorization: "Bearer user-token" },
    }),
    new URL("http://bff.test/demand/airport-pair?origin_airport_id=airport-a&destination_airport_id=airport-b"),
    config,
  );

  expect(response?.status).toBe(200);
  const body = (await response?.json()) as { demand: Record<string, unknown> };
  expect(body.demand).toMatchObject({
    destination_airport_id: "airport-b",
    origin_airport_id: "airport-a",
  });
  expect(body.demand.origin_daily_passengers).toBeGreaterThan(0);
  expect(body.demand.destination_daily_passengers).toBeGreaterThan(0);
  expect(body.demand.distance_km).toBeGreaterThan(0);
  expect(body.demand.breakdown).toBeDefined();

  // The demand path must no longer read or write backend region links.
  expect(requestedPaths.some((path) => path.includes("/region-link"))).toBe(false);
});

function airport(id: string, iataCode: string, regionId: string, geom: string): Record<string, unknown> {
  return {
    geom,
    iata_code: iataCode,
    icao_code: `IC${iataCode}`,
    id,
    intl_name: iataCode,
    region_id: regionId,
  };
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

function region(
  id: string,
  countryId: string,
  population: number,
  gdpPerCapita: number,
  tourismScore: number,
  businessScore: number,
): Record<string, unknown> {
  return {
    business_score: businessScore,
    country_id: countryId,
    gdp_per_capita: gdpPerCapita,
    id,
    intl_name: id,
    population,
    tourism_score: tourismScore,
  };
}

function token(): string {
  const payload = btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 }))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");

  return `header.${payload}.signature`;
}
