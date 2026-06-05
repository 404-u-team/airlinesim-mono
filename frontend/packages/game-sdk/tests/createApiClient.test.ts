import { expect, test } from "bun:test";

import { createApiClient } from "../src/api/createApiClient";

test("uses short UI timeout by default", () => {
  const client = createApiClient({ baseUrl: "https://bff.example.com" });

  expect(client.axios.defaults.timeout).toBe(8_000);
});

test("allows callers to override timeout", () => {
  const client = createApiClient({
    baseUrl: "https://bff.example.com",
    timeoutMs: 12_000,
  });

  expect(client.axios.defaults.timeout).toBe(12_000);
});
