import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

import { formatMoneyValue, formatNumberValue, formatPercentValue } from "../src/formatters";
import { fleetMessages } from "../src/i18n";

test("fleet API client uses only BFF fleet endpoints for purchase flow", () => {
  const source = readFileSync(new URL("../src/api.ts", import.meta.url), "utf8");

  expect(source).toContain("/fleet/market");
  expect(source).toContain("/fleet/purchase-preview");
  expect(source).toContain("/fleet/aircraft");
  expect(source).not.toContain("/aircraft-types");
  expect(source).not.toContain("/airports");
  expect(source).not.toContain("/aircrafts");
  expect(source).not.toContain('"/aircraft"');
});

test("fleet i18n dictionaries expose the same product keys", () => {
  const enKeys = Object.keys(fleetMessages.en).sort();
  const ruKeys = Object.keys(fleetMessages.ru).sort();

  expect(ruKeys).toEqual(enKeys);
  expect(enKeys).toContain("purchase.confirm.title");
  expect(enKeys).toContain("warning.FLEET_RUNWAY_TOO_SHORT");
  expect(enKeys).toContain("warning.FLEET_TAIL_NUMBER_EXISTS");
});

test("fleet formatters respect selected locale", () => {
  expect(formatMoneyValue("en", 1234567)).toContain("$");
  expect(formatNumberValue("ru", 1234567)).not.toBe(formatNumberValue("en", 1234567));
  expect(formatPercentValue("en", 0.42)).toBe("42%");
});
