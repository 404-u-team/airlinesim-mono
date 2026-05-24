import { expect, test } from "bun:test";

import { jsonResponse, notFound } from "../src/http";

test("jsonResponse returns JSON content", async () => {
  const response = jsonResponse({ ok: true }, { status: 201 });

  expect(response.status).toBe(201);
  expect(response.headers.get("Content-Type")).toBe("application/json");
  expect(await response.json()).toEqual({ ok: true });
});

test("notFound returns a 404 JSON error", async () => {
  const response = notFound();

  expect(response.status).toBe(404);
  expect(await response.json()).toEqual({ error: "Not found" });
});
