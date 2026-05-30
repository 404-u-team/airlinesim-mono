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

test("generates airport-pair demand and stores it on the region link", async () => {
  const mutations: Array<{ body: unknown; path: string }> = [];

  globalThis.fetch = async (input, init) => {
    const url = String(input);

    if (url === "http://backend.test/airline/me") {
      return json({ id: "airline-1" });
    }

    if (url === "http://backend.test/auth/login") {
      return json({ access_token: token() });
    }

    if (url === "http://backend.test/airports") {
      return json({
        airports: [
          airport("airport-a", "AAA", "region-a", "POINT(29.000000 41.000000)", 840),
          airport("airport-b", "BBB", "region-b", "POINT(2.550000 49.010000)", 720),
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

    if (url === "http://backend.test/region-links") {
      return json({
        region_links: [
          {
            base_daily_demand_ab: -1,
            base_daily_demand_ba: -1,
            business: 0.7,
            diaspora: 0.4,
            id: "link-1",
            region_a: "region-a",
            region_b: "region-b",
            tourism: 0.8,
          },
        ],
      });
    }

    if (url === "http://backend.test/region-link/link-1" && init?.method === "PUT") {
      mutations.push({
        body: JSON.parse(String(init.body)),
        path: url,
      });

      return json({ id: "link-1" });
    }

    return json({ error: "unexpected" }, 500);
  };

  const response = await handleDemandRequest(
    new Request("http://bff.test/demand/airport-pair?origin_airport_id=airport-a&destination_airport_id=airport-b", {
      headers: {
        Authorization: "Bearer user-token",
      },
    }),
    new URL("http://bff.test/demand/airport-pair?origin_airport_id=airport-a&destination_airport_id=airport-b"),
    config,
  );

  expect(response?.status).toBe(200);
  expect(await response?.json()).toMatchObject({
    demand: {
      cached: true,
      destination_airport_id: "airport-b",
      origin_airport_id: "airport-a",
      region_link_id: "link-1",
    },
  });
  expect(mutations).toHaveLength(1);
  expect(mutations[0]?.body).toMatchObject({
    base_daily_demand_ab: expect.any(Number),
    base_daily_demand_ba: expect.any(Number),
    id: "link-1",
    region_a: "region-a",
    region_b: "region-b",
  });
});

function airport(
  id: string,
  iataCode: string,
  regionId: string,
  geom: string,
  runwayUses: number,
): Record<string, unknown> {
  return {
    fuel_price_multiplier: 1,
    gate_fee: 250,
    geom,
    iata_code: iataCode,
    id,
    intl_name: iataCode,
    max_runway_length_m: 3600,
    max_runway_uses_per_day: runwayUses,
    region_id: regionId,
    runway_fee: 900,
    stand_fee: 150,
    works_at_night: true,
  };
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: {
      "Content-Type": "application/json",
    },
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
