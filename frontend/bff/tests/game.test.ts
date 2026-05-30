import { afterEach, expect, test } from "bun:test";

import type { BffConfig } from "../src/config";

import { handleGameRequest } from "../src/modules/game";

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

test("builds finance overview from user fleet and backend aircraft types", async () => {
  globalThis.fetch = async (input) => {
    const url = String(input);

    if (url === "http://backend.test/airline/me") {
      return json({ balance: 12_000_000, credit_rating: 81, id: "airline-1" });
    }

    if (url === "http://backend.test/auth/login") {
      return json({ access_token: token() });
    }

    if (url === "http://backend.test/aircrafts") {
      return json({
        items: [
          {
            current_maintenance_points: 70,
            max_maintenance_points_cached: 100,
            type_id: "type-1",
          },
        ],
      });
    }

    if (url === "http://backend.test/aircraft-types") {
      return json({
        items: [
          {
            id: "type-1",
            maint_cost_per_flight_hour: 500,
            price_per_unit: 10_000_000,
          },
        ],
      });
    }

    if (url === "http://backend.test/airports") {
      return json({ airports: [] });
    }

    if (url === "http://backend.test/regions") {
      return json({ regions: [] });
    }

    if (url === "http://backend.test/region-links") {
      return json({ region_links: [] });
    }

    return json({ error: "unexpected" }, 500);
  };

  const response = await handleGameRequest(
    new Request("http://bff.test/game/finance-overview", {
      headers: {
        Authorization: "Bearer user-token",
      },
    }),
    new URL("http://bff.test/game/finance-overview"),
    config,
  );

  expect(response?.status).toBe(200);
  expect(await response?.json()).toMatchObject({
    metrics: {
      average_maintenance_ratio: 0.7,
      balance: 12_000_000,
      daily_maintenance_reserve: 4000,
      fleet_value: 10_000_000,
      owned_aircraft: 1,
    },
  });
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: {
      "Content-Type": "application/json",
    },
    status,
  });
}

function token(): string {
  const payload = btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 }))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");

  return `header.${payload}.signature`;
}
