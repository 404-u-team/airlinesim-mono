import { afterEach, expect, test } from "bun:test";

import type { BffConfig } from "../src/config";

import { requireAdminCapability } from "../src/auth";
import { handleAdminRequest } from "../src/modules/admin";
import { listAdminAudit, recordAdminAudit } from "../src/modules/admin/audit";
import { handleImportRequest } from "../src/modules/import";

const config: BffConfig = {
  backendBaseUrl: "http://backend.test",
  port: 4200,
};
const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

test("admin audit stores operational metadata without credentials", async () => {
  const userId = `admin-${crypto.randomUUID()}`;
  await recordAdminAudit({
    action: "patch",
    capability: "world.manage",
    entity_id: "airport-1",
    entity_type: "airport",
    success: true,
    user_id: userId,
  });

  const entry = (await listAdminAudit()).find((item) => item.user_id === userId);

  expect(entry).toMatchObject({ action: "patch", capability: "world.manage", entity_id: "airport-1", success: true });
  expect(JSON.stringify(entry)).not.toContain("Bearer ");
});

test("admin session exposes world.manage for a backend-authorized admin", async () => {
  globalThis.fetch = async (input) => {
    expect(String(input)).toBe("http://backend.test/countries");
    return json({ countries: [] });
  };

  const response = await handleAdminRequest(
    authorizedRequest("http://bff.test/admin/session"),
    new URL("http://bff.test/admin/session"),
    config,
  );

  expect(response?.status).toBe(200);
  expect(await response?.json()).toEqual({
    authenticated: true,
    authorized: true,
    capabilities: ["world.manage"],
  });
});

test("admin session does not grant capabilities after backend denial", async () => {
  globalThis.fetch = async () => json({ error: "forbidden" }, 403);

  const response = await handleAdminRequest(
    authorizedRequest("http://bff.test/admin/session"),
    new URL("http://bff.test/admin/session"),
    config,
  );

  expect(response?.status).toBe(200);
  expect(await response?.json()).toEqual({
    authenticated: true,
    authorized: false,
    capabilities: [],
  });
});

test("admin capability rejects an unauthenticated request", async () => {
  const response = await requireAdminCapability(
    new Request("http://bff.test/admin/session"),
    config,
    "world.manage",
  );

  expect(response?.status).toBe(401);
  expect(await response?.json()).toMatchObject({
    error: {
      code: "AUTH_REQUIRED",
    },
  });
});

test("admin capability rejects an authenticated player after backend denial", async () => {
  globalThis.fetch = async () => json({ error: "forbidden" }, 403);

  const response = await requireAdminCapability(
    authorizedRequest("http://bff.test/admin/world/readiness"),
    config,
    "world.manage",
  );

  expect(response?.status).toBe(403);
  expect(await response?.json()).toMatchObject({
    error: {
      code: "ADMIN_ACCESS_REQUIRED",
    },
  });
});

test("world-data import is protected before a job can start", async () => {
  const response = await handleImportRequest(
    new Request("http://bff.test/import/world-data", { method: "POST" }),
    new URL("http://bff.test/import/world-data"),
    config,
  );

  expect(response?.status).toBe(401);
  expect(await response?.json()).toMatchObject({
    error: {
      code: "AUTH_REQUIRED",
    },
  });
});

test("world-data import ignores a forged capability in the browser payload", async () => {
  globalThis.fetch = async () => json({ error: "forbidden" }, 403);

  const request = new Request("http://bff.test/admin/import/world-data", {
    body: JSON.stringify({ capabilities: ["world.manage"], mode: "dry-run" }),
    headers: {
      Authorization: "Bearer user-token",
      "Content-Type": "application/json",
    },
    method: "POST",
  });
  const response = await handleImportRequest(request, new URL(request.url), config);

  expect(response?.status).toBe(403);
  expect(await response?.json()).toMatchObject({
    error: {
      code: "ADMIN_ACCESS_REQUIRED",
    },
  });
});

test("world readiness blocks an empty world", async () => {
  installReadinessFetch({});

  const response = await adminRequest("/admin/world/readiness");
  const payload = await response?.json();

  expect(response?.status).toBe(200);
  expect(payload.status).toBe("blocked");
  expect(payload.blockers.map((item: { code: string }) => item.code)).toContain("COUNTRIES_EMPTY");
  expect(payload.blockers.map((item: { code: string }) => item.code)).toContain("AIRPORTS_INSUFFICIENT");
});

test("world readiness accepts a minimally valid world with lazy demand warning", async () => {
  installReadinessFetch({
    aircraftTypes: [{ id: "type-1", min_runway_length_m: 1800 }],
    airports: [validAirport("airport-1", "region-1"), validAirport("airport-2", "region-2")],
    countries: [{ id: "country-1", iso: "KR" }],
    links: [{ business: 0.5, diaspora: 0.5, id: "link-1", region_a: "region-1", region_b: "region-2", tourism: 0.5 }],
    regions: [validRegion("region-1"), validRegion("region-2")],
  });

  const response = await adminRequest("/admin/world/readiness");
  const payload = await response?.json();

  expect(response?.status).toBe(200);
  expect(payload.status).toBe("warning");
  expect(payload.blockers).toEqual([]);
});

test("world readiness accepts an empty lazy region-link cache", async () => {
  installReadinessFetch({
    aircraftTypes: [{ id: "type-1", min_runway_length_m: 1800 }],
    airports: [validAirport("airport-1", "region-1"), validAirport("airport-2", "region-2")],
    countries: [{ id: "country-1", iso: "KR" }],
    regions: [validRegion("region-1"), validRegion("region-2")],
  });

  const response = await adminRequest("/admin/world/readiness");
  const payload = await response?.json();

  expect(response?.status).toBe(200);
  expect(payload.status).toBe("ready");
  expect(payload.blockers).toEqual([]);
});

test("world readiness blocks incomplete airports and duplicate symmetric links", async () => {
  const incompleteAirport = validAirport("airport-1", "region-1");
  delete incompleteAirport.geog;
  const link = { business: 0.5, diaspora: 0.5, id: "link-1", region_a: "region-1", region_b: "region-2", tourism: 0.5 };
  installReadinessFetch({
    aircraftTypes: [{ id: "type-1", min_runway_length_m: 1800 }],
    airports: [incompleteAirport, validAirport("airport-2", "region-2")],
    countries: [{ id: "country-1", iso: "KR" }],
    links: [link, { ...link, id: "link-2", region_a: "region-2", region_b: "region-1" }],
    regions: [validRegion("region-1"), validRegion("region-2")],
  });

  const response = await adminRequest("/admin/world/readiness");
  const payload = await response?.json();
  const blockerCodes = payload.blockers.map((item: { code: string }) => item.code);

  expect(response?.status).toBe(200);
  expect(payload.status).toBe("blocked");
  expect(blockerCodes).toContain("AIRPORT_DATA_INCOMPLETE");
  expect(blockerCodes).toContain("REGION_LINK_INVALID");
});

async function adminRequest(path: string): Promise<null | Response> {
  const request = authorizedRequest(`http://bff.test${path}`);

  return handleAdminRequest(request, new URL(request.url), config);
}

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

function installReadinessFetch(state: {
  aircraftTypes?: Record<string, unknown>[];
  airports?: Record<string, unknown>[];
  countries?: Record<string, unknown>[];
  links?: Record<string, unknown>[];
  regions?: Record<string, unknown>[];
}): void {
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.endsWith("/countries")) {
      return json({ countries: state.countries ?? [] });
    }
    if (url.endsWith("/regions")) {
      return json({ regions: state.regions ?? [] });
    }
    if (url.endsWith("/airports")) {
      return json({ airports: state.airports ?? [] });
    }
    if (url.endsWith("/region-links")) {
      return json({ region_links: state.links ?? [] });
    }
    if (url.endsWith("/aircraft-types")) {
      return json({ items: state.aircraftTypes ?? [] });
    }
    return json({ error: "unexpected" }, 500);
  };
}

function validAirport(id: string, regionId: string): Record<string, unknown> {
  return {
    country_id: "country-1",
    gate_fee: 1,
    geog: "POINT (1 1)",
    iata_code: id === "airport-1" ? "ICN" : "GMP",
    icao_code: id === "airport-1" ? "RKSI" : "RKSS",
    id,
    intl_name: id,
    local_name: id,
    max_runway_length_m: 3000,
    max_runway_uses_per_day: 100,
    region_id: regionId,
    runway_fee: 1,
    stand_fee: 1,
    timezone: "Asia/Seoul",
    works_at_night: true,
  };
}

function validRegion(id: string): Record<string, unknown> {
  return {
    business_score: 0.5,
    country_id: "country-1",
    gdp_per_capita: 10,
    id,
    intl_name: id,
    local_name: id,
    population: 100,
    tourism_score: 0.5,
  };
}
