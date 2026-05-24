import { afterEach, expect, test } from "bun:test";

import type { BffConfig } from "../src/config";

import { handleProxyRequest } from "../src/modules/proxy";

const config: BffConfig = {
  backendBaseUrl: "http://backend.test",
  port: 4200,
};
const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

test("retries backend 500 responses up to a successful response", async () => {
  const calls: string[] = [];
  globalThis.fetch = async (input) => {
    calls.push(String(input));

    if (calls.length < 3) {
      return json({ error: "temporary" }, 500);
    }

    return json({ ok: true });
  };

  const response = await handleProxyRequest(
    new Request("http://bff.test/airline/me", {
      headers: {
        Authorization: "Bearer token",
      },
    }),
    new URL("http://bff.test/airline/me"),
    config,
  );

  expect(response?.status).toBe(200);
  expect(await response?.json()).toEqual({ ok: true });
  expect(calls).toEqual([
    "http://backend.test/airline/me",
    "http://backend.test/airline/me",
    "http://backend.test/airline/me",
  ]);
});

test("caches list route payloads and filters by q plus exact field parameters", async () => {
  const backendListCalls: string[] = [];
  globalThis.fetch = async (input) => {
    const url = String(input);

    if (url === "http://backend.test/airline/me") {
      return json({ id: "airline-1" });
    }

    backendListCalls.push(url);

    return json({
      airports: [
        {
          country_id: "TR",
          iata_code: "IST",
          icao_code: "LTFM",
          id: "airport-1",
          intl_name: "Istanbul Airport",
          municipality: "Istanbul",
        },
        {
          country_id: "FR",
          iata_code: "CDG",
          icao_code: "LFPG",
          id: "airport-2",
          intl_name: "Paris Charles de Gaulle",
          municipality: "Paris",
        },
      ],
    });
  };

  const firstResponse = await getProtected("http://bff.test/airports?refresh=true&country_id=TR&q=istanbul");
  const secondResponse = await getProtected("http://bff.test/airports?country_id=FR&q=paris");

  expect(await firstResponse.json()).toMatchObject({
    airports: [{ id: "airport-1" }],
    meta: {
      cached: false,
      total: 2,
    },
  });
  expect(await secondResponse.json()).toMatchObject({
    airports: [{ id: "airport-2" }],
    meta: {
      cached: true,
      total: 2,
    },
  });
  expect(backendListCalls).toEqual(["http://backend.test/airports"]);
});

test("refresh=true reloads a cached list route from backend", async () => {
  let backendListCalls = 0;
  globalThis.fetch = async (input) => {
    const url = String(input);

    if (url === "http://backend.test/airline/me") {
      return json({ id: "airline-1" });
    }

    backendListCalls += 1;

    return json({
      countries: [
        {
          id: `country-${String(backendListCalls)}`,
          intl_name: "Turkey",
          iso: "TR",
        },
      ],
    });
  };

  const cachedResponse = await getProtected("http://bff.test/countries?refresh=true");
  const refreshedResponse = await getProtected("http://bff.test/countries?refresh=true");

  expect(await cachedResponse.json()).toMatchObject({
    countries: [{ id: "country-1" }],
    meta: {
      cached: false,
    },
  });
  expect(await refreshedResponse.json()).toMatchObject({
    countries: [{ id: "country-2" }],
    meta: {
      cached: false,
    },
  });
  expect(backendListCalls).toBe(2);
});

async function getProtected(url: string): Promise<Response> {
  const request = new Request(url, {
    headers: {
      Authorization: "Bearer token",
    },
  });
  const response = await handleProxyRequest(request, new URL(url), config);

  if (!response) {
    throw new Error("Expected BFF proxy response");
  }

  return response;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: {
      "Content-Type": "application/json",
    },
    status,
  });
}
