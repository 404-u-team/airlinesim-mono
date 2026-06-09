import { expect, test } from "bun:test";

import type { RoutePlanningSnapshot } from "../src/modules/operations/planning";

import { estimateHubFee } from "../src/modules/hubs/fee";
import { isHubOrigin } from "../src/modules/routes/planning";

test("estimateHubFee scales with airport and region weight and clamps", () => {
  const small = estimateHubFee({}, undefined);
  const large = estimateHubFee(
    { gate_fee: 400, max_runway_length_m: 4000, max_runway_uses_per_day: 700, runway_fee: 300, stand_fee: 200 },
    { business_score: 80, gdp_per_capita: 60_000, population: 12_000_000, tourism_score: 70 },
  );

  expect(small).toBe(200_000);
  expect(large).toBeGreaterThan(small);
  expect(large).toBeLessThanOrEqual(5_000_000);
});

test("isHubOrigin accepts the base and any stored hub, rejects others", () => {
  const snapshot = {
    airline: { id: "airline-1", starting_airport_id: "base-1" },
    hubAirportIds: ["hub-2"],
  } as unknown as RoutePlanningSnapshot;

  expect(isHubOrigin(snapshot, "base-1")).toBe(true);
  expect(isHubOrigin(snapshot, "hub-2")).toBe(true);
  expect(isHubOrigin(snapshot, "elsewhere")).toBe(false);
  expect(isHubOrigin(snapshot, undefined)).toBe(false);
});
