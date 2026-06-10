import { afterEach, expect, test } from "bun:test";

import type { AirportDemandProfile } from "../src/modules/import/build/catchment";

import { saveCalibration } from "../src/modules/demand/calibration";
import { buildAirportMap, resolveStructural, type RunnerAirport, type RunnerRegion } from "../src/modules/demand/calibration-runner";
import { calculatePairDemand, DEFAULT_CALIBRATION, type MarketEndpoint } from "../src/modules/demand/model";
import { setAirportProfilesForTesting } from "../src/modules/demand/profiles";
import { computeAirportPairDemand } from "../src/modules/demand/service";

afterEach(() => {
  setAirportProfilesForTesting(null);
});

function profile(iata: string, icao: string, catchment: number, capacityShare: number, capacityIndex: number): AirportDemandProfile {
  return { capacityIndex, capacityShare, iataCode: iata, icaoCode: icao, localCatchmentPopulation: catchment, marketCatchmentPopulation: catchment, marketKey: iata };
}

function airport(iata: string, icao: string, regionId: string, lon: number, lat: number): RunnerAirport & { id: string } {
  return { geom: `POINT(${lon} ${lat})`, iata_code: iata, icao_code: icao, id: `airport:${iata}`, region_id: regionId };
}

function region(id: string, country: string): RunnerRegion {
  return { business_score: 0.6, country_id: country, gdp_per_capita: 30_000, id, population: 4_000_000, tourism_score: 0.5 };
}

function market(overrides: Partial<MarketEndpoint> = {}): MarketEndpoint {
  return { businessScore: 0.6, catchmentPopulation: 3_000_000, countryId: "A", gdpPerCapita: 30_000, tourismScore: 0.4, ...overrides };
}

test("calibration structural and runtime demand share one structural formula", () => {
  // Two airports with non-trivial capacityShare AND capacityIndex so both the
  // metro-split and the strength factors are exercised on both code paths.
  setAirportProfilesForTesting(
    new Map([
      ["LEMD", profile("MAD", "LEMD", 6_000_000, 0.8, 1.1)],
      ["LIRF", profile("FCO", "LIRF", 4_000_000, 0.7, 0.6)],
    ]),
  );
  const baseScale = 5.5;
  const propensity = { ES: 1.2, IT: 0.85 };
  saveCalibration({ params: { ...DEFAULT_CALIBRATION, baseScale }, propensityByCountry: propensity, version: 1 });

  const mad = airport("MAD", "LEMD", "es", -3.57, 40.49);
  const fco = airport("FCO", "LIRF", "it", 12.25, 41.8);
  const { airportByIata } = buildAirportMap([mad, fco]);
  const regionById = new Map([["es", region("es", "ES")], ["it", region("it", "IT")]]);

  const resolved = resolveStructural("MAD", "FCO", airportByIata, regionById)!;
  expect(resolved).not.toBeNull();

  // Scorecard model = baseScale · sqrt(propensity) · structural.
  const expectedSymmetric = baseScale * Math.sqrt(propensity.ES * propensity.IT) * resolved.structural;

  const runtime = computeAirportPairDemand(mad, fco, region("es", "ES"), region("it", "IT"), resolved.distanceKm);
  const runtimeSymmetric = (runtime.originDailyPassengers + runtime.destinationDailyPassengers) / 2;

  // Both paths must agree on the symmetric one-way demand (rounding aside).
  expect(runtimeSymmetric).toBeGreaterThan(0);
  expect(Math.abs(runtimeSymmetric - expectedSymmetric) / expectedSymmetric).toBeLessThan(0.02);
});

test("capacity-share and strength factors are applied exactly once each", () => {
  const neutral = new Map([
    ["LEMD", profile("MAD", "LEMD", 6_000_000, 1, 1)],
    ["LIRF", profile("FCO", "LIRF", 4_000_000, 1, 1)],
  ]);
  saveCalibration({ params: DEFAULT_CALIBRATION, propensityByCountry: {}, version: 1 });
  const mad = airport("MAD", "LEMD", "es", -3.57, 40.49);
  const fco = airport("FCO", "LIRF", "it", 12.25, 41.8);

  setAirportProfilesForTesting(neutral);
  const base = computeAirportPairDemand(mad, fco, region("es", "ES"), region("it", "IT"), 1300);

  // Halve one end's capacity share and quarter the other's strength; the demand must
  // scale by exactly that share product and sqrt(strength product) — never squared.
  setAirportProfilesForTesting(
    new Map([
      ["LEMD", profile("MAD", "LEMD", 6_000_000, 0.5, 1)],
      ["LIRF", profile("FCO", "LIRF", 4_000_000, 1, 0.25)],
    ]),
  );
  const scaled = computeAirportPairDemand(mad, fco, region("es", "ES"), region("it", "IT"), 1300);

  const expectedFactor = 0.5 * Math.sqrt(1 * 0.25); // share product · pair strength
  expect(scaled.originDailyPassengers / base.originDailyPassengers).toBeCloseTo(expectedFactor, 1);
  expect(scaled.breakdown.capacityShareFactor).toBeCloseTo(0.5, 5);
  expect(scaled.breakdown.airportStrengthFactor).toBeCloseTo(Math.sqrt(0.25), 5);
});

test("smoke: trunk > medium > thin route demand, all ≥ 1", () => {
  // Thin: small catchments, short hop. Medium: mid catchments. Trunk: big rich metros.
  const thin = calculatePairDemand(market({ catchmentPopulation: 250_000 }), market({ catchmentPopulation: 300_000, countryId: "B" }), 500).originToDestination;
  const medium = calculatePairDemand(market({ catchmentPopulation: 2_000_000 }), market({ catchmentPopulation: 2_500_000, countryId: "B" }), 900).originToDestination;
  const trunk = calculatePairDemand(market({ catchmentPopulation: 9_000_000, gdpPerCapita: 50_000 }), market({ catchmentPopulation: 11_000_000, countryId: "B", gdpPerCapita: 48_000 }), 1500).originToDestination;

  expect(thin).toBeGreaterThanOrEqual(1);
  expect(medium).toBeGreaterThan(thin);
  expect(trunk).toBeGreaterThan(medium);
});

test("flattened distance curve lifts long-haul relative to mid-haul vs the old curve", () => {
  const a = market({ catchmentPopulation: 5_000_000 });
  const b = market({ catchmentPopulation: 5_000_000, countryId: "B" });
  const oldCurve = { ...DEFAULT_CALIBRATION, distanceD0: 1800, distanceP: 1.25 };

  const longNew = calculatePairDemand(a, b, 6000, {}, DEFAULT_CALIBRATION).originToDestination;
  const longOld = calculatePairDemand(a, b, 6000, {}, oldCurve).originToDestination;
  const midNew = calculatePairDemand(a, b, 1000, {}, DEFAULT_CALIBRATION).originToDestination;
  const midOld = calculatePairDemand(a, b, 1000, {}, oldCurve).originToDestination;

  // Long-haul gains share relative to mid-haul under the flatter (new) curve.
  expect(longNew / midNew).toBeGreaterThan(longOld / midOld);
});
