import { rm } from "node:fs/promises";
import { resolve } from "node:path";

import { afterAll, expect, test } from "bun:test";

import { advanceFuelPrice, getCurrentFuelUnitPrice, getFuelPriceSnapshot, recordFuelPriceChange } from "../src/modules/fuel/price";

const fuelStorePath = resolve(import.meta.dir, "../data/game-state/fuel-price.json");

afterAll(async () => {
  await rm(fuelStorePath, { force: true });
});

test("fuel price is an independent per-tonne value", async () => {
  const snapshot = await recordFuelPriceChange({
    price: 900,
    recorded_at: "2026-06-05T12:00:00.000Z",
  });

  expect(snapshot?.price).toBe(900);
  // Price is per tonne, so the cost unit equals the price (no separate scaling).
  expect(snapshot?.unit_price).toBe(900);
  expect(snapshot?.source).toBe("internal");
  expect(getCurrentFuelUnitPrice()).toBe(900);

  const current = await getFuelPriceSnapshot();

  expect(current.price).toBe(900);
  expect(current.recorded_at).toBe("2026-06-05T12:00:00.000Z");
});

test("fuel price stays within bounds as it walks", async () => {
  for (let step = 0; step < 50; step += 1) {
    const snapshot = await advanceFuelPrice();
    expect(snapshot.price).toBeGreaterThanOrEqual(560);
    expect(snapshot.price).toBeLessThanOrEqual(1180);
  }
});
