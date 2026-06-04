import { expect, test } from "bun:test";

import { calculatePassengerDemand, gravityDemand } from "../src/modules/demand/model";

const airport = {
  fuel_price_multiplier: 1,
  gate_fee: 250,
  iata_code: "AAA",
  max_runway_length_m: 3600,
  max_runway_uses_per_day: 600,
  runway_fee: 900,
  stand_fee: 150,
  works_at_night: true,
};

test("gravity demand rises with population and GDP and falls with distance", () => {
  const base = { gdp_per_capita: 20_000, population: 5_000_000 };
  const larger = { gdp_per_capita: 40_000, population: 15_000_000 };

  expect(gravityDemand(larger, base, 1000)).toBeGreaterThan(gravityDemand(base, base, 1000));
  expect(gravityDemand(base, base, 500)).toBeGreaterThan(gravityDemand(base, base, 5000));
});

test("passenger demand preserves directional differences", () => {
  const result = calculatePassengerDemand(
    airport,
    airport,
    { business_score: 0.8, country_id: "A", gdp_per_capita: 55_000, population: 12_000_000, tourism_score: 0.4 },
    { business_score: 0.5, country_id: "B", gdp_per_capita: 12_000, population: 18_000_000, tourism_score: 0.95 },
    2200,
    { business: 0.7, diaspora: 0.4, tourism: 0.8 },
  );

  expect(result.originToDestination).toBeGreaterThan(1);
  expect(result.destinationToOrigin).toBeGreaterThan(1);
  expect(result.originToDestination).not.toBe(result.destinationToOrigin);
});
