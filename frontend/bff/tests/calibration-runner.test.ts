import { afterEach, expect, test } from "bun:test";

import type { AirportDemandProfile } from "../src/modules/import/build/catchment";

import { runCalibration } from "../src/modules/demand/calibration-runner";
import { setAirportProfilesForTesting } from "../src/modules/demand/profiles";

afterEach(() => {
  setAirportProfilesForTesting(null);
});

function profile(iata: string, icao: string, catchment: number, capacityIndex = 1): AirportDemandProfile {
  return {
    capacityIndex,
    capacityShare: 1,
    iataCode: iata,
    icaoCode: icao,
    localCatchmentPopulation: catchment,
    marketCatchmentPopulation: catchment,
    marketKey: iata,
  };
}

function airport(iata: string, icao: string, regionId: string, lon: number, lat: number) {
  return { geom: `POINT(${lon} ${lat})`, iata_code: iata, icao_code: icao, region_id: regionId };
}

function region(id: string, country: string) {
  return { business_score: 0.6, country_id: country, gdp_per_capita: 30_000, id, population: 4_000_000, tourism_score: 0.5 };
}

test("calibration fits propensity from seed anchors and produces a scorecard", async () => {
  setAirportProfilesForTesting(
    new Map([
      ["LEMD", profile("MAD", "LEMD", 6_000_000)],
      ["LEBL", profile("BCN", "LEBL", 5_000_000)],
      ["LIRF", profile("FCO", "LIRF", 4_000_000)],
      ["LIMC", profile("MXP", "LIMC", 7_000_000)],
    ]),
  );

  const airports = [
    airport("MAD", "LEMD", "es", -3.57, 40.49),
    airport("BCN", "LEBL", "es", 2.08, 41.3),
    airport("FCO", "LIRF", "it", 12.25, 41.8),
    airport("MXP", "LIMC", "it", 8.72, 45.63),
  ];
  const regions = [region("es", "ES"), region("it", "IT")];

  const result = await runCalibration({ airports, refresh: false, regions });

  // MAD-BCN and FCO-MXP from the seed set resolve to real structural predictions.
  expect(result.anchorsUsed).toBeGreaterThanOrEqual(2);
  expect(result.artifact.version).toBeGreaterThan(0);
  expect(result.artifact.propensityByCountry.ES).toBeGreaterThan(0);
  expect(result.artifact.propensityByCountry.IT).toBeGreaterThan(0);
  expect(result.scorecard.length).toBe(result.anchorsUsed);
  expect(result.scorecard[0]).toHaveProperty("errorPct");
  // Segmented diagnostics are produced for transparency.
  expect(result.segments.length).toBeGreaterThan(0);
  expect(result.segments[0]).toHaveProperty("medianRatio");
});

