import { afterEach, expect, test } from "bun:test";

import type { BffConfig } from "../src/config";

import { buildMapState, handleGameRequest } from "../src/modules/game";

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

test("builds dashboard summary with next action for airline without aircraft", async () => {
  globalThis.fetch = async (input) => {
    const url = String(input);

    if (url === "http://backend.test/airline/me") {
      return json({
        balance: 20_000_000,
        id: "airline-1",
        name: "Seoul Air",
        starting_airport_id: "airport-1",
      });
    }

    if (url === "http://backend.test/auth/login") {
      return json({ access_token: token() });
    }

    if (url === "http://backend.test/aircrafts") {
      return json({ items: [] });
    }

    if (url === "http://backend.test/aircraft-types") {
      return json({ items: [{ id: "type-1", min_runway_length_m: 1800, price_per_unit: 10_000_000 }] });
    }

    if (url === "http://backend.test/airports") {
      return json({
        airports: [
          {
            geog: "POINT (126.4505 37.4691)",
            iata_code: "ICN",
            id: "airport-1",
            intl_name: "Incheon International",
            max_runway_length_m: 3750,
            max_runway_uses_per_day: 600,
            region_id: "region-1",
            works_at_night: true,
          },
        ],
      });
    }

    if (url === "http://backend.test/regions") {
      return json({ regions: [{ id: "region-1", intl_name: "Seoul" }] });
    }

    if (url === "http://backend.test/region-links") {
      return json({ region_links: [] });
    }

    return json({ error: "unexpected" }, 500);
  };

  const response = await handleGameRequest(
    authorizedRequest("http://bff.test/game/dashboard-summary"),
    new URL("http://bff.test/game/dashboard-summary"),
    config,
  );
  const payload = await response?.json();

  expect(response?.status).toBe(200);
  expect(payload).toMatchObject({
    base: {
      status: "ready",
    },
    fleet: {
      total_aircraft: 0,
    },
    next_action: {
      code: "BUY_FIRST_AIRCRAFT",
      target_path: "/fleet/overview",
    },
    routes: {
      active_routes: 0,
      capabilities: "configured",
    },
  });
});

test("builds dashboard summary with route planning action when aircraft exists", async () => {
  globalThis.fetch = async (input) => {
    const url = String(input);

    if (url === "http://backend.test/airline/me") {
      return json({
        balance: 3_000_000,
        id: "airline-1",
        name: "Seoul Air",
        starting_airport_id: "airport-1",
      });
    }

    if (url === "http://backend.test/auth/login") {
      return json({ access_token: token() });
    }

    if (url === "http://backend.test/aircrafts") {
      return json({
        items: [{ current_maintenance_points: 90, max_maintenance_points_cached: 100, status: "idle", type_id: "type-1" }],
      });
    }

    if (url === "http://backend.test/aircraft-types") {
      return json({ items: [{ id: "type-1", min_runway_length_m: 1800, price_per_unit: 10_000_000 }] });
    }

    if (url === "http://backend.test/airports") {
      return json({
        airports: [
          {
            geog: "POINT (126.4505 37.4691)",
            iata_code: "ICN",
            id: "airport-1",
            intl_name: "Incheon International",
            max_runway_length_m: 3750,
            max_runway_uses_per_day: 600,
            region_id: "region-1",
            works_at_night: true,
          },
        ],
      });
    }

    if (url === "http://backend.test/regions") {
      return json({ regions: [{ id: "region-1", intl_name: "Seoul" }] });
    }

    if (url === "http://backend.test/region-links") {
      return json({ region_links: [] });
    }

    return json({ error: "unexpected" }, 500);
  };

  const response = await handleGameRequest(
    authorizedRequest("http://bff.test/game/dashboard-summary"),
    new URL("http://bff.test/game/dashboard-summary"),
    config,
  );
  const payload = await response?.json();

  expect(response?.status).toBe(200);
  expect(payload).toMatchObject({
    next_action: {
      code: "PLAN_FIRST_ROUTE",
      target_path: "/airports/routes",
    },
  });
  expect(payload.alerts.some((alert: { code: string }) => alert.code === "LOW_BALANCE")).toBe(true);
});

test("keeps dashboard available when backend region-links fail", async () => {
  globalThis.fetch = async (input) => {
    const url = String(input);

    if (url === "http://backend.test/airline/me") {
      return json({
        balance: 20_000_000,
        id: "airline-1",
        name: "Seoul Air",
        starting_airport_id: "airport-1",
      });
    }
    if (url === "http://backend.test/auth/login") {
      return json({ access_token: token() });
    }
    if (url === "http://backend.test/aircrafts") {
      return json({ items: [] });
    }
    if (url === "http://backend.test/aircraft-types") {
      return json({ items: [] });
    }
    if (url === "http://backend.test/airports") {
      return json({ airports: [{ id: "airport-1", region_id: "region-1" }] });
    }
    if (url === "http://backend.test/regions") {
      return json({ regions: [{ id: "region-1" }] });
    }
    if (url === "http://backend.test/region-links") {
      return json({ error: "internal" }, 500);
    }

    return json({ error: "unexpected" }, 500);
  };

  const response = await handleGameRequest(
    authorizedRequest("http://bff.test/game/dashboard-summary"),
    new URL("http://bff.test/game/dashboard-summary"),
    config,
  );

  expect(response?.status).toBe(200);
  expect(await response?.json()).toMatchObject({
    airline: { id: "airline-1" },
    routes: { active_routes: 0 },
  });
});

test("builds map state with base and opportunity airport features", async () => {
  globalThis.fetch = async (input) => {
    const url = String(input);

    if (url === "http://backend.test/airline/me") {
      return json({
        balance: 20_000_000,
        id: "airline-1",
        starting_airport_id: "airport-1",
      });
    }

    if (url === "http://backend.test/auth/login") {
      return json({ access_token: token() });
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
            geog: "POINT (126.4505 37.4691)",
            iata_code: "ICN",
            id: "airport-1",
            intl_name: "Incheon International",
            max_runway_length_m: 3750,
            max_runway_uses_per_day: 600,
            region_id: "region-1",
            works_at_night: true,
          },
          {
            geog: "POINT (139.7798 35.5523)",
            iata_code: "HND",
            id: "airport-2",
            intl_name: "Tokyo Haneda",
            max_runway_length_m: 3360,
            max_runway_uses_per_day: 500,
            region_id: "region-2",
            works_at_night: true,
          },
        ],
      });
    }

    if (url === "http://backend.test/regions") {
      return json({
        regions: [
          { business_score: 0.8, id: "region-1", intl_name: "Seoul", tourism_score: 0.5 },
          { business_score: 0.9, id: "region-2", intl_name: "Tokyo", tourism_score: 0.7 },
        ],
      });
    }

    if (url === "http://backend.test/region-links") {
      return json({
        region_links: [
          {
            base_daily_demand_ab: 420,
            base_daily_demand_ba: 390,
            region_a: "region-1",
            region_b: "region-2",
          },
        ],
      });
    }

    return json({ error: "unexpected" }, 500);
  };

  const response = await handleGameRequest(
    authorizedRequest("http://bff.test/game/map-state?include_opportunities=true"),
    new URL("http://bff.test/game/map-state?include_opportunities=true"),
    config,
  );
  const payload = await response?.json();

  expect(response?.status).toBe(200);
  expect(payload.airports.features.length).toBe(2);
  expect(payload.routes.features).toEqual([]);
  expect(payload.capabilities.routes).toBe("configured");
  expect(payload.airports.features[0].geometry.type).toBe("Point");
});

test("builds map state flight features from overlay operations", () => {
  const payload = buildMapState(
    {
      aircrafts: [],
      aircraftTypes: [],
      airline: {
        id: "airline-1",
        starting_airport_id: "airport-1",
      },
      airports: [
        {
          geog: "POINT (126.4505 37.4691)",
          iata_code: "ICN",
          id: "airport-1",
          intl_name: "Incheon International",
          region_id: "region-1",
        },
        {
          geog: "POINT (139.7798 35.5523)",
          iata_code: "HND",
          id: "airport-2",
          intl_name: "Tokyo Haneda",
          region_id: "region-2",
        },
      ],
      regionLinks: [],
      regions: [],
    },
    new URLSearchParams("scope=dashboard&include_opportunities=false"),
    [],
    {
      flights: [
        {
          arrival_at: "2026-06-05T12:00:00.000Z",
          departure_at: "2026-06-05T10:00:00.000Z",
          destination_airport_id: "airport-2",
          expected: { profit: 5000 },
          flight_number: "SA101",
          id: "flight-1",
          origin_airport_id: "airport-1",
          route_id: "route-1",
          status: "scheduled",
        },
      ],
      schedules: [],
    },
  );

  expect(payload).toMatchObject({
    flights: {
      features: [
        {
          geometry: { type: "Point" },
          properties: {
            flight_number: "SA101",
            id: "flight-1",
            status: "scheduled",
          },
        },
      ],
      type: "FeatureCollection",
    },
  });
});

function authorizedRequest(url: string): Request {
  return new Request(url, {
    headers: {
      Authorization: "Bearer user-token",
    },
  });
}

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
