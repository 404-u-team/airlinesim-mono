import { afterEach, expect, test } from "bun:test";

import type { BffConfig } from "../src/config";
import type { ImportLogInput } from "../src/modules/import/runtime/logger";

import { backendRequest } from "../src/modules/import/backend/api";
import { fetchCachedText } from "../src/modules/import/runtime/storage";

const config: BffConfig = { backendBaseUrl: "http://backend.test", port: 4200 };
const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

test("source fetch errors log the exact URL, cache path and cause", async () => {
  const logs: ImportLogInput[] = [];
  globalThis.fetch = async () => {
    throw new Error("unknown certificate verification error", { cause: new Error("unable to verify the first certificate") });
  };

  await expect(fetchCachedText("data/raw/source.csv", "https://source.test/data.csv", true, (entry) => logs.push(entry)))
    .rejects.toThrow("unknown certificate verification error");

  expect(logs.at(-1)).toMatchObject({
    details: {
      cause: "unable to verify the first certificate",
      error: "unknown certificate verification error",
      path: "data/raw/source.csv",
      url: "https://source.test/data.csv",
    },
    level: "error",
    operation: "source.fetch",
    stage: "building",
  });
});

test("backend errors log endpoint and entity context without payload or token", async () => {
  const logs: ImportLogInput[] = [];
  globalThis.fetch = async () => new Response(JSON.stringify({ error: "database constraint failed" }), {
    headers: { "Content-Type": "application/json" },
    status: 500,
  });

  await expect(backendRequest(config, "/aircraft-types", {
    body: { manufacturer_id: "" },
    entityType: "aircraft-type",
    log: (entry) => logs.push(entry),
    method: "POST",
    sourceKey: "aircraft-type:A20N",
    token: "secret-token",
  })).rejects.toThrow();

  expect(logs.at(-1)).toMatchObject({
    details: {
      details: { error: "database constraint failed" },
      method: "POST",
      path: "/aircraft-types",
      status: 500,
    },
    entityType: "aircraft-type",
    level: "error",
    operation: "backend.request",
    sourceKey: "aircraft-type:A20N",
  });
  expect(JSON.stringify(logs)).not.toContain("secret-token");
  expect(JSON.stringify(logs)).not.toContain("manufacturer_id");
});

test("airport conflicts expose the backend reason and log as a warning", async () => {
  const logs: ImportLogInput[] = [];
  globalThis.fetch = async () => new Response(JSON.stringify({ error: 4 }), {
    headers: { "Content-Type": "application/json" },
    status: 409,
  });

  await expect(backendRequest(config, "/airport", {
    entityType: "airport",
    log: (entry) => logs.push(entry),
    method: "POST",
    sourceKey: "airport:HSWW",
    token: "secret-token",
  })).rejects.toThrow("Airport with this ICAO code already exists.");

  expect(logs.at(-1)).toMatchObject({
    details: {
      code: "AIRPORT_ICAO_EXISTS",
      status: 409,
    },
    entityType: "airport",
    level: "warning",
    message: "Backend request conflict",
    sourceKey: "airport:HSWW",
  });
});
