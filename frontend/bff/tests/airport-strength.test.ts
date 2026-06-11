import { afterEach, expect, test } from "bun:test";

import type { AirportDemandProfile } from "../src/modules/import/build/catchment";

import { airportPairStrengthFactor, airportStrengthFactor, setAirportProfilesForTesting } from "../src/modules/demand/profiles";

afterEach(() => {
  setAirportProfilesForTesting(null);
});

function profile(icao: string, capacityIndex: number): AirportDemandProfile {
  return {
    capacityIndex,
    capacityShare: 1,
    iataCode: icao.slice(0, 3),
    icaoCode: icao,
    localCatchmentPopulation: 1_000_000,
    marketCatchmentPopulation: 1_000_000,
    marketKey: icao,
  };
}

test("airport strength tracks capacityIndex, clamped to a sane band", () => {
  setAirportProfilesForTesting(
    new Map([
      ["HUBB", profile("HUBB", 1.6)], // mega-hub, clamped to ceil
      ["MIDD", profile("MIDD", 0.45)], // regional/secondary
      ["TINY", profile("TINY", 0.04)], // grass strip, clamped to floor
    ]),
  );

  expect(airportStrengthFactor("HUBB")).toBe(1.2); // ceil
  expect(airportStrengthFactor("TINY")).toBe(0.1); // floor
  expect(airportStrengthFactor("MIDD")).toBeCloseTo(0.45, 5);
});

test("missing profile is neutral (strength 1) so pre-import stays unaffected", () => {
  setAirportProfilesForTesting(new Map());
  expect(airportStrengthFactor("NONE")).toBe(1);
  expect(airportStrengthFactor(undefined)).toBe(1);
  expect(airportPairStrengthFactor("NONE", "ALSO")).toBe(1);
});

test("a weak airport drags the pair capture below a hub pair", () => {
  setAirportProfilesForTesting(
    new Map([
      ["HUBB", profile("HUBB", 1.2)],
      ["WEAK", profile("WEAK", 0.12)],
    ]),
  );

  const hubPair = airportPairStrengthFactor("HUBB", "HUBB");
  const mixedPair = airportPairStrengthFactor("HUBB", "WEAK");

  expect(hubPair).toBeCloseTo(1.2, 5);
  expect(mixedPair).toBeLessThan(hubPair);
  expect(mixedPair).toBeCloseTo(Math.sqrt(1.2 * 0.12), 5);
});
