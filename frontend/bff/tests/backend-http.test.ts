import { afterEach, expect, test } from "bun:test";

import type { BffConfig } from "../src/config";

import { requestBackendJson } from "../src/backend-http";

const config: BffConfig = {
  backendBaseUrl: "http://backend.test",
  port: 4200,
};
const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

test("coalesces identical in-flight JSON GET requests", async () => {
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    await Bun.sleep(10);
    return json({ airports: [{ id: "airport-1" }] });
  };

  const [first, second] = await Promise.all([
    requestBackendJson(config, "/airports", { token: "Bearer token" }),
    requestBackendJson(config, "/airports", { token: "Bearer token" }),
  ]);

  expect(first).toEqual(second);
  expect(calls).toBe(1);

  await requestBackendJson(config, "/airports", { token: "Bearer token" });
  expect(calls).toBe(2);
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: {
      "Content-Type": "application/json",
    },
    status,
  });
}
