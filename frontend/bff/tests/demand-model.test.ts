import { expect, test } from "bun:test";

import type { MarketEndpoint } from "../src/modules/demand/model";

import {
  calculatePairDemand,
  distanceImpedance,
  explainPairDemand,
  gravityMass,
  groundCompetitionFactor,
  shortHaulFactor,
} from "../src/modules/demand/model";

function market(overrides: Partial<MarketEndpoint> = {}): MarketEndpoint {
  return {
    businessScore: 0.6,
    catchmentPopulation: 3_000_000,
    countryId: "A",
    gdpPerCapita: 30_000,
    tourismScore: 0.4,
    ...overrides,
  };
}

test("gravity mass rises with catchment and GDP", () => {
  const base = market({ catchmentPopulation: 3_000_000, gdpPerCapita: 20_000 });
  const bigger = market({ catchmentPopulation: 12_000_000, gdpPerCapita: 45_000 });

  expect(gravityMass(bigger, base)).toBeGreaterThan(gravityMass(base, base));
});

test("distance impedance falls with distance", () => {
  expect(distanceImpedance(500)).toBeGreaterThan(distanceImpedance(5000));
});

test("pair demand preserves directional differences", () => {
  const origin = market({ businessScore: 0.8, catchmentPopulation: 12_000_000, countryId: "A", gdpPerCapita: 55_000, tourismScore: 0.4 });
  const destination = market({ businessScore: 0.5, catchmentPopulation: 18_000_000, countryId: "B", gdpPerCapita: 12_000, tourismScore: 0.95 });

  const result = calculatePairDemand(origin, destination, 2200, { business: 0.7, diaspora: 0.4, tourism: 0.8 });

  expect(result.originToDestination).toBeGreaterThan(1);
  expect(result.destinationToOrigin).toBeGreaterThan(1);
  expect(result.originToDestination).not.toBe(result.destinationToOrigin);
});

test("higher aviation propensity raises demand for the same market", () => {
  const sleepy = calculatePairDemand(market({ propensity: 1 }), market({ countryId: "B", propensity: 1 }), 1200);
  const lively = calculatePairDemand(market({ propensity: 2 }), market({ countryId: "B", propensity: 2 }), 1200);

  expect(lively.originToDestination).toBeGreaterThan(sleepy.originToDestination);
});

test("short-haul factor collapses intra-metro pairs and saturates by 300 km", () => {
  expect(shortHaulFactor(44)).toBe(0);
  expect(shortHaulFactor(300)).toBe(1);
  expect(shortHaulFactor(700)).toBe(1);
  expect(calculatePairDemand(market(), market({ countryId: "A" }), 44).originToDestination).toBeLessThanOrEqual(1);
});

test("ground competition penalises same-country medium hauls hardest, cross-border mildly", () => {
  expect(groundCompetitionFactor(469, true)).toBeLessThan(0.6); // domestic 469 km: rail/road
  expect(groundCompetitionFactor(200, true)).toBe(0.3); // floor for short domestic
  expect(groundCompetitionFactor(1500, true)).toBe(1); // long domestic: flying wins again
  expect(groundCompetitionFactor(800, true)).toBeGreaterThan(groundCompetitionFactor(500, true));

  // Cross-border short hops bleed to rail/adjacent airports too, but less severely.
  expect(groundCompetitionFactor(469, false)).toBeLessThan(1); // some penalty now
  expect(groundCompetitionFactor(469, false)).toBeGreaterThan(groundCompetitionFactor(469, true)); // milder than domestic
  expect(groundCompetitionFactor(150, false)).toBe(0.6); // floor for very short cross-border
  expect(groundCompetitionFactor(900, false)).toBe(1); // medium+ cross-border: no penalty
});

test("a short domestic pair is suppressed versus an identical cross-border pair", () => {
  const a = market({ countryId: "A" });
  const domestic = calculatePairDemand(a, market({ countryId: "A" }), 469).originToDestination;
  const international = calculatePairDemand(a, market({ countryId: "B" }), 469).originToDestination;

  expect(domestic).toBeLessThan(international);
});

test("direction factor is centred near 1.0 (does not double one-way demand)", () => {
  const { breakdown } = explainPairDemand(market(), market({ countryId: "B" }), 1500);
  expect(breakdown.directionFactorOriginToDestination).toBeLessThan(1.35);
  expect(breakdown.directionFactorOriginToDestination).toBeGreaterThan(0.7);
});

test("breakdown exposes catchment, propensity and direction factors", () => {
  const { breakdown } = explainPairDemand(
    market({ catchmentPopulation: 4_000_000 }),
    market({ catchmentPopulation: 9_000_000, countryId: "B" }),
    1500,
  );

  expect(breakdown.originCatchment).toBe(4_000_000);
  expect(breakdown.destinationCatchment).toBe(9_000_000);
  expect(breakdown.propensityFactor).toBe(1);
  expect(breakdown.sameCountry).toBe(false);
  expect(breakdown.baseDemand).toBeGreaterThan(0);
});
