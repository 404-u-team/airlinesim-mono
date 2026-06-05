import { rm } from "node:fs/promises";
import { resolve } from "node:path";

import { afterAll, expect, test } from "bun:test";

import { getFuelPriceSnapshot, recordFuelPriceChange, toFuelUnitPrice } from "../src/modules/fuel/price";

const fuelStorePath = resolve(import.meta.dir, "../data/game-state/fuel-price.json");

afterAll(async () => {
  await rm(fuelStorePath, { force: true });
});

test("fuel price exposes backend global price and derived cost unit", async () => {
  const snapshot = await recordFuelPriceChange({
    price: 112,
    recorded_at: "2026-06-05T12:00:00.000Z",
  });

  expect(snapshot?.price).toBe(112);
  expect(snapshot?.unit_price).toBe(1064);
  expect(toFuelUnitPrice(100)).toBe(950);

  const current = await getFuelPriceSnapshot();

  expect(current.price).toBe(112);
  expect(current.recorded_at).toBe("2026-06-05T12:00:00.000Z");
});
