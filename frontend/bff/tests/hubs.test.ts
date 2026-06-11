import { afterEach, expect, test } from "bun:test";

import type { BffConfig } from "../src/config";
import type { RoutePlanningSnapshot } from "../src/modules/operations/planning";

import { estimateHubFee } from "../src/modules/hubs/fee";
import { handleHubsRequest } from "../src/modules/hubs";
import { isHubOrigin } from "../src/modules/routes/planning";
import { cache } from "../src/modules/proxy";

const config: BffConfig = {
  backendAdminLogin: "admin",
  backendAdminPassword: "admin",
  backendBaseUrl: "http://backend.test",
  port: 4200,
};
const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  cache.clear();
});

test("estimateHubFee scales with airport and region weight and clamps", () => {
  const small = estimateHubFee({}, undefined);
  const large = estimateHubFee(
    { gate_fee: 400, max_runway_length_m: 4000, max_runway_uses_per_day: 700, runway_fee: 300, stand_fee: 200 },
    { business_score: 80, gdp_per_capita: 60_000, population: 12_000_000, tourism_score: 70 },
  );

  expect(small).toBe(200_000);
  expect(large).toBeGreaterThan(small);
  expect(large).toBeLessThanOrEqual(5_000_000);
});

test("isHubOrigin accepts the base and any stored hub, rejects others", () => {
  const snapshot = {
    airline: { id: "airline-1", starting_airport_id: "base-1" },
    hubAirportIds: ["hub-2"],
  } as unknown as RoutePlanningSnapshot;

  expect(isHubOrigin(snapshot, "base-1")).toBe(true);
  expect(isHubOrigin(snapshot, "hub-2")).toBe(true);
  expect(isHubOrigin(snapshot, "elsewhere")).toBe(false);
  expect(isHubOrigin(snapshot, undefined)).toBe(false);
});

test("GET /hubs/preview calculates detailed hub fee and balance status", async () => {
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url === "http://backend.test/auth/login") {
      // Return a dummy JWT token whose payload is decodable by getJwtExpiresAt (requires a split payload dot structure)
      // {"exp": 9999999999} in base64: eyJleHAiOjk5OTk5OTk5OTl9
      return json({ access_token: "header.eyJleHAiOjk5OTk5OTk5OTl9.signature" });
    }
    if (url === "http://backend.test/airline/me") {
      return json({ balance: 2_000_000, id: "airline-1", starting_airport_id: "airport-base" });
    }
    if (url === "http://backend.test/aircrafts") {
      return json({ items: [] });
    }
    if (url === "http://backend.test/aircraft-types") {
      return json({ items: [] });
    }
    if (url === "http://backend.test/airports") {
      return json({
        airports: [
          {
            country_id: "US",
            gate_fee: 100,
            iata_code: "LAX",
            icao_code: "KLAX",
            id: "airport-lax",
            intl_name: "Los Angeles International",
            max_runway_length_m: 3500,
            max_runway_uses_per_day: 800,
            municipality: "Los Angeles",
            region_id: "region-ca",
            runway_fee: 50,
            stand_fee: 80,
            works_at_night: true,
          },
        ],
      });
    }
    if (url === "http://backend.test/countries") {
      return json({ countries: [] });
    }
    if (url === "http://backend.test/regions") {
      return json({
        regions: [
          {
            business_score: 90,
            gdp_per_capita: 70_000,
            id: "region-ca",
            population: 15_000_000,
            tourism_score: 80,
          },
        ],
      });
    }
    if (url === "http://backend.test/region-links") {
      return json({ region_links: [] });
    }
    return json({ error: "not mocked" }, 404);
  };

  const response = await handleHubsRequest(
    new Request("http://bff.test/hubs/preview?airport_id=airport-lax", {
      headers: { Authorization: "Bearer token" },
    }),
    new URL("http://bff.test/hubs/preview?airport_id=airport-lax"),
    config,
  );



  expect(response).not.toBeNull();
  expect(response!.status).toBe(200);

  const data = await response!.json();
  expect(data.airport.id).toBe("airport-lax");
  expect(data.region.id).toBe("region-ca");
  expect(data.fee_details.final_fee).toBeGreaterThanOrEqual(200_000);
  expect(data.fee_details.airport_weight).toBeGreaterThan(0);
  expect(data.fee_details.region_weight).toBeGreaterThan(0);
  expect(data.balance.available).toBe(2_000_000);
  expect(data.balance.can_afford).toBe(true);
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}
