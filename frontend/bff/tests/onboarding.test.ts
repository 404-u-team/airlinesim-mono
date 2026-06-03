import { afterEach, expect, test } from "bun:test";

import type { BffConfig } from "../src/config";

import { invalidateBackendAdminToken } from "../src/auth";
import { handleOnboardingRequest } from "../src/modules/onboarding";
import { cache } from "../src/modules/proxy";

const config: BffConfig = {
  backendAdminLogin: "admin",
  backendAdminPassword: "password",
  backendBaseUrl: "http://backend.test",
  port: 4200,
};

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  invalidateBackendAdminToken();
  cache.clear();
});

test("GET /onboarding/session - AUTH_REQUIRED when no auth header", async () => {
  const request = new Request("http://bff.test/onboarding/session");
  const response = await handleOnboardingRequest(request, new URL(request.url), config);

  expect(response?.status).toBe(200);
  const data = await response?.json();
  expect(data).toEqual({
    authenticated: false,
    airlineExists: false,
    onboardingStep: "AUTH_REQUIRED",
    recommendedNextRoute: "/login",
  });
});

test("GET /onboarding/session - AIRLINE_REQUIRED when user token is valid but airline returns 404", async () => {
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url === "http://backend.test/airline/me") {
      return json({ error: "not found" }, 404);
    }
    return json({ ok: true });
  };

  const request = new Request("http://bff.test/onboarding/session", {
    headers: { Authorization: "Bearer token" },
  });
  const response = await handleOnboardingRequest(request, new URL(request.url), config);

  expect(response?.status).toBe(200);
  const data = await response?.json();
  expect(data).toEqual({
    authenticated: true,
    airlineExists: false,
    onboardingStep: "AIRLINE_REQUIRED",
    recommendedNextRoute: "/onboarding/airline",
  });
});

test("GET /onboarding/session - READY when user token is valid and airline exists", async () => {
  // Pre-populate airports in proxy cache
  cache.set("/airports", {
    fetchedAt: Date.now(),
    items: [
      {
        country_id: "US",
        gate_fee: 100,
        iata_code: "LAX",
        icao_code: "KLAX",
        id: "airport-1",
        intl_name: "Los Angeles",
        max_runway_length_m: 3000,
        max_runway_uses_per_day: 400,
        region_id: "region-1",
        stand_fee: 200,
        works_at_night: true,
      },
    ],
  });

  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url === "http://backend.test/auth/login") {
      return json({ access_token: token() });
    }
    if (url === "http://backend.test/airline/me") {
      return json({
        id: "airline-1",
        iata_code: "AA",
        icao_code: "AAL",
        name: "American",
        starting_airport_id: "airport-1",
      });
    }
    if (url === "http://backend.test/aircrafts") {
      return json({ items: [] }); // no planes
    }
    return json({ ok: true });
  };

  const request = new Request("http://bff.test/onboarding/session", {
    headers: { Authorization: "Bearer token" },
  });
  const response = await handleOnboardingRequest(request, new URL(request.url), config);

  expect(response?.status).toBe(200);
  const data = await response?.json();
  expect(data.authenticated).toBe(true);
  expect(data.airlineExists).toBe(true);
  expect(data.onboardingStep).toBe("READY");
  expect(data.recommendedNextRoute).toBe("/fleet/overview");
  expect(data.startingAirport.id).toBe("airport-1");
  expect(data.startingAirport.score).toBeGreaterThan(1000); // has IATA and runway
});

test("GET /onboarding/airports - ranks and scores airports correctly", async () => {
  cache.set("/airports", {
    fetchedAt: Date.now(),
    items: [
      {
        country_id: "US",
        gate_fee: 200,
        iata_code: "LAX",
        icao_code: "KLAX",
        id: "airport-1",
        intl_name: "Los Angeles",
        max_runway_length_m: 3500,
        max_runway_uses_per_day: 500,
        region_id: "region-1",
        stand_fee: 300,
        works_at_night: true,
      },
      {
        country_id: "US",
        gate_fee: 10,
        icao_code: "KFOO", // no IATA
        id: "airport-2",
        intl_name: "Small Strip",
        max_runway_length_m: 1200,
        max_runway_uses_per_day: 10,
        region_id: "region-1",
        stand_fee: 10,
        works_at_night: false,
      },
    ],
  });

  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url === "http://backend.test/auth/login") {
      return json({ access_token: token() });
    }

    return json({ id: "airline-1" });
  };

  const request = new Request("http://bff.test/onboarding/airports?q=lax", {
    headers: { Authorization: "Bearer token" },
  });
  const response = await handleOnboardingRequest(request, new URL(request.url), config);

  expect(response?.status).toBe(200);
  const data = await response?.json();
  expect(data.airports.length).toBe(1);
  const lax = data.airports[0];
  expect(lax.id).toBe("airport-1");
  expect(lax.score).toBeGreaterThan(10000); // boosted by exact matching query
  expect(lax.warnings).toEqual([]);

  // Check the second airport (non-matching) is filtered out
  const request2 = new Request("http://bff.test/onboarding/airports", {
    headers: { Authorization: "Bearer token" },
  });
  const response2 = await handleOnboardingRequest(request2, new URL(request2.url), config);
  const data2 = await response2?.json();
  expect(data2.airports.length).toBe(2);
  expect(data2.airports[0].id).toBe("airport-1"); // LAX ranked first because of score
  expect(data2.airports[1].id).toBe("airport-2");
  expect(data2.airports[1].warnings).toContain("SHORT_RUNWAY");
  expect(data2.airports[1].warnings).toContain("NO_NIGHT_OPS");
  expect(data2.airports[1].warnings).toContain("LOW_SLOT_CAPACITY");
});

test("POST /onboarding/airline - validates code length and formats", async () => {
  globalThis.fetch = async () => json({ id: "airline-1" });

  const request = new Request("http://bff.test/onboarding/airline", {
    body: JSON.stringify({
      iata_code: "A", // too short
      icao_code: "ABC",
      name: "Bad Airline",
      starting_airport_id: "airport-1",
    }),
    headers: { Authorization: "Bearer token" },
    method: "POST",
  });
  const response = await handleOnboardingRequest(request, new URL(request.url), config);

  expect(response?.status).toBe(400);
  const data = await response?.json();
  expect(data.error.code).toBe("AIRLINE_VALIDATION_FAILED");
});

test("POST /onboarding/airline - forwards creation to backend on success", async () => {
  cache.set("/airports", {
    fetchedAt: Date.now(),
    items: [
      {
        country_id: "US",
        gate_fee: 100,
        iata_code: "LAX",
        icao_code: "KLAX",
        id: "airport-1",
        intl_name: "Los Angeles",
        max_runway_length_m: 3000,
        max_runway_uses_per_day: 300,
        region_id: "region-1",
        stand_fee: 200,
        works_at_night: true,
      },
    ],
  });

  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (url === "http://backend.test/auth/login") {
      return json({ access_token: token() });
    }
    if (url === "http://backend.test/airline/me") {
      return json({ error: "not found" }, 404);
    }
    if (url === "http://backend.test/airline" && init?.method === "POST") {
      const body = JSON.parse(String(init.body));
      expect(body.name).toBe("Capital Fly");
      expect(body.iata_code).toBe("CF");
      expect(body.icao_code).toBe("CFL");
      expect(body.starting_airport_id).toBe("airport-1");

      return json({ id: "airline-123" });
    }
    return json({ ok: true });
  };

  const request = new Request("http://bff.test/onboarding/airline", {
    body: JSON.stringify({
      iata_code: "cf", // auto uppercase
      icao_code: "cfl", // auto uppercase
      name: "Capital Fly",
      starting_airport_id: "airport-1",
    }),
    headers: { Authorization: "Bearer token" },
    method: "POST",
  });
  const response = await handleOnboardingRequest(request, new URL(request.url), config);

  expect(response?.status).toBe(200);
  const data = await response?.json();
  expect(data.airline.id).toBe("airline-123");
  expect(data.airline.iata_code).toBe("CF");
  expect(data.airline.icao_code).toBe("CFL");
  expect(data.startingAirport.id).toBe("airport-1");
  expect(data.recommendedNextRoute).toBe("/fleet/overview");
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
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
