import { expect, test } from "bun:test";

import { normalizeBaseUrl } from "../src/utils/normalizeBaseUrl";

test("removes trailing slashes from base URLs", () => {
  expect(normalizeBaseUrl("https://api.example.com///")).toBe("https://api.example.com");
});

test("keeps base URLs without trailing slashes unchanged", () => {
  expect(normalizeBaseUrl("https://api.example.com/v1")).toBe("https://api.example.com/v1");
});
