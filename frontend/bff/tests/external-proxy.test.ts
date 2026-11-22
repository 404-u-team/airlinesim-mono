import { afterEach, expect, test } from "bun:test";

import type { BffConfig } from "../src/config";

import { setExternalProxy } from "../src/external-http";
import { handleAdminRequest } from "../src/modules/admin";
import { listAdminAudit } from "../src/modules/admin/audit";
import { fetchSource } from "../src/modules/import/runtime/source-fetch";

const originalFetch = globalThis.fetch;
const config: BffConfig = { backendBaseUrl: "http://backend.test", port: 4200 };
const path = "http://bff.test/admin/settings/external-proxy";

afterEach(() => {
  globalThis.fetch = originalFetch;
  setExternalProxy(null);
});

test("proxy settings require authentication and the world.manage capability", async () => {
  globalThis.fetch = async () => new Response(null, { status: 403 });

  const unauthorized = await request("GET", undefined, false);
  expect(unauthorized?.status).toBe(401);
  expect(await unauthorized?.json()).toMatchObject({ error: { code: "AUTH_REQUIRED" } });

  const forbidden = await request("PUT", { proxyUrl: "http://proxy.test:3128" });
  expect(forbidden?.status).toBe(403);
  expect(await forbidden?.json()).toMatchObject({ error: { code: "ADMIN_ACCESS_REQUIRED" } });
});

test("saved settings route import downloads without sending backend requests through the proxy", async () => {
  const sourceRequests: Array<BunFetchRequestInit | undefined> = [];
  globalThis.fetch = async (url, init) => {
    if (String(url) === "http://backend.test/countries") {
      expect(init?.proxy).toBeUndefined();
      return Response.json({ countries: [] });
    }
    expect(String(url)).toBe("https://source.test/data.csv");
    sourceRequests.push(init);
    return new Response("data");
  };

  const proxyUrl = "http://proxy-user:proxy-password@proxy.test:3128";
  const save = await request("PUT", { proxyUrl });
  expect(save?.status).toBe(200);
  expect(await save?.json()).toEqual({ origin: "http://proxy.test:3128" });

  const read = await request("GET");
  expect(read?.headers.get("Cache-Control")).toBe("no-store");
  expect(await read?.json()).toEqual({ origin: "http://proxy.test:3128" });
  expect(JSON.stringify(await listAdminAudit())).not.toContain("proxy-password");

  const invalid = await request("PUT", { proxyUrl: "socks5://proxy.test:3128" });
  expect(invalid?.status).toBe(400);

  const headers = { Authorization: "Bearer source-token" };
  const download = () => fetchSource("https://source.test/data.csv", "/tmp/source.csv", (response) => response.text(), undefined, headers);
  expect(await download()).toBe("data");
  expect(sourceRequests[0]).toMatchObject({ headers, proxy: `${proxyUrl}/`, signal: expect.any(AbortSignal) });

  expect(await (await request("PUT", { proxyUrl: null }))?.json()).toEqual({ origin: null });
  expect(await download()).toBe("data");
  expect(sourceRequests[1]?.proxy).toBeUndefined();
});

test("failed proxied requests are not retried directly and redact proxy credentials", async () => {
  const proxyUrl = "https://proxy-user:proxy-password@proxy.test:3128/";
  setExternalProxy(proxyUrl);
  let attempts = 0;
  globalThis.fetch = async (_url, init) => {
    expect(init?.proxy).toBe(proxyUrl);
    attempts += 1;
    throw Object.assign(new Error(`Rejected by ${proxyUrl}`), { status: 407 });
  };
  const logs: unknown[] = [];

  await expect(fetchSource("https://source.test/data.csv", "/tmp/source.csv", (response) => response.text(), (entry) => logs.push(entry)))
    .rejects.toThrow("External request through the configured proxy failed (HTTP 407)");

  expect(attempts).toBeGreaterThan(0);
  expect(JSON.stringify(logs)).not.toContain("proxy-password");
});

function request(method: string, body?: unknown, auth = true): Promise<null | Response> {
  const url = new URL(path);
  return handleAdminRequest(new Request(url, {
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: auth ? { Authorization: "Bearer user-token" } : {},
    method,
  }), url, config);
}
