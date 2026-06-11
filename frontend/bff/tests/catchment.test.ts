import { expect, test } from "bun:test";

import type { GeoCity } from "../src/modules/import/runtime/sources";

import {
  buildAirportDemandProfiles,
  buildCityGrid,
  catchmentPopulation,
  metroCodeForAirport,
  METRO_BY_AIRPORT,
  type AirportLite,
} from "../src/modules/import/build/catchment";

function city(name: string, latitude: number, longitude: number, population: number): GeoCity {
  return { admin1Code: "", countryCode: "XX", latitude, longitude, name, population, timezone: "UTC" };
}

// Cologne ~50.94, 6.96; Paderborn ~51.72, 8.75 (~150 km apart). Düsseldorf and the
// Rhine-Ruhr metros sit next to Cologne, far from Paderborn.
const COLOGNE = { lat: 50.94, lon: 6.96 };
const PADERBORN = { lat: 51.72, lon: 8.75 };

const cities = [
  city("Cologne", 50.94, 6.96, 1_080_000),
  city("Düsseldorf", 51.22, 6.78, 620_000),
  city("Bonn", 50.73, 7.1, 330_000),
  city("Paderborn", 51.72, 8.75, 150_000),
  city("Sydney", -33.87, 151.21, 5_000_000), // far away, must not leak in
];

const grid = buildCityGrid(cities);

test("catchment sums nearby cities with distance decay, ignores far ones", () => {
  const cologne = catchmentPopulation(COLOGNE.lat, COLOGNE.lon, grid);
  const paderborn = catchmentPopulation(PADERBORN.lat, PADERBORN.lon, grid);

  // Cologne pulls in its own ~1.08M plus weighted Düsseldorf/Bonn.
  expect(cologne).toBeGreaterThan(1_300_000);
  // A big city near a small town must produce a much bigger catchment than the
  // small town — the v1 admin1 bug gave them the *same* number.
  expect(cologne).toBeGreaterThan(paderborn * 3);
  // Paderborn is small and isolated.
  expect(paderborn).toBeLessThan(400_000);
  // Sydney is on the other side of the planet — zero leakage.
  expect(catchmentPopulation(COLOGNE.lat, COLOGNE.lon, grid)).toBeLessThan(2_500_000);
});

test("in-city weight ~1, decay halves at the decay radius", () => {
  const single = buildCityGrid([city("Solo", 0, 0, 1_000_000)]);
  expect(catchmentPopulation(0, 0, single)).toBe(1_000_000);
  // ~35 km east of the equator point → weight ~0.5.
  const halfDeg = 35 / 110.574;
  const atDecay = catchmentPopulation(0, halfDeg, single);
  expect(atDecay).toBeGreaterThan(450_000);
  expect(atDecay).toBeLessThan(550_000);
});

test("grid finds cities across the antimeridian", () => {
  const pacific = buildCityGrid([city("EastSide", 0, 179.9, 800_000)]);
  // Query just west of +180 should still see the city at 179.9.
  expect(catchmentPopulation(0, -179.9, pacific)).toBeGreaterThan(0);
});

test("demand profiles: multi-airport metro shares one catchment, split by capacity", () => {
  const moscowCities = buildCityGrid([city("Moscow", 55.75, 37.62, 12_500_000)]);
  const airports: AirportLite[] = [
    { capacityIndex: 1.8, iataCode: "SVO", icaoCode: "UUEE", latitude: 55.97, longitude: 37.41 },
    { capacityIndex: 1.5, iataCode: "DME", icaoCode: "UUDD", latitude: 55.41, longitude: 37.9 },
    { capacityIndex: 0.7, iataCode: "VKO", icaoCode: "UUWW", latitude: 55.6, longitude: 37.27 },
    { capacityIndex: 1.0, iataCode: "CGN", icaoCode: "EDDK", latitude: 50.87, longitude: 7.14 }, // unrelated singleton
  ];

  const profiles = buildAirportDemandProfiles(airports, moscowCities);
  const svo = profiles.get("UUEE")!;
  const dme = profiles.get("UUDD")!;
  const vko = profiles.get("UUWW")!;
  const cgn = profiles.get("EDDK")!;

  // All three Moscow airports belong to one market with the same catchment.
  expect(svo.marketKey).toBe("MOW");
  expect(svo.marketCatchmentPopulation).toBe(dme.marketCatchmentPopulation);
  expect(svo.marketCatchmentPopulation).toBe(vko.marketCatchmentPopulation);
  // Capacity shares split the market and sum to ~1.
  expect(svo.capacityShare).toBeGreaterThan(vko.capacityShare);
  expect(svo.capacityShare + dme.capacityShare + vko.capacityShare).toBeCloseTo(1, 5);
  // The unrelated airport is its own market with full share.
  expect(cgn.marketKey).toBe("CGN");
  expect(cgn.capacityShare).toBe(1);
});

test("competitive allocation splits a shared city between two nearby airports", () => {
  // City midway (~20 km) between two equal airports ~40 km apart.
  const cities = buildCityGrid([city("Shared", 0, 0.18, 1_000_000)]);
  const airports: AirportLite[] = [
    { capacityIndex: 1, iataCode: "AAA", icaoCode: "AAAA", latitude: 0, longitude: 0 },
    { capacityIndex: 1, iataCode: "BBB", icaoCode: "BBBB", latitude: 0, longitude: 0.36 },
  ];

  const profiles = buildAirportDemandProfiles(airports, cities);
  const a = profiles.get("AAAA")!;
  const b = profiles.get("BBBB")!;

  // Roughly equal split, and each gets well under the full city (the other airport
  // + outside option take the rest) — the old model gave both ~the full weight.
  expect(a.marketCatchmentPopulation).toBeGreaterThan(380_000);
  expect(a.marketCatchmentPopulation).toBeLessThan(490_000);
  expect(Math.abs(a.marketCatchmentPopulation - b.marketCatchmentPopulation)).toBeLessThan(5_000);
});

test("a big airport out-competes a tiny neighbour for the same city", () => {
  const cities = buildCityGrid([city("Town", 0, 0, 1_000_000)]);
  const airports: AirportLite[] = [
    { capacityIndex: 2, iataCode: "BIG", icaoCode: "BIGG", latitude: 0, longitude: 0 },
    { capacityIndex: 0.3, iataCode: "SML", icaoCode: "SMLL", latitude: 0, longitude: 0.18 },
  ];

  const profiles = buildAirportDemandProfiles(airports, cities);
  const big = profiles.get("BIGG")!;
  const small = profiles.get("SMLL")!;

  expect(big.marketCatchmentPopulation).toBeGreaterThan(small.marketCatchmentPopulation * 5);
});

test("metro membership maps member airports to their metro code", () => {
  expect(metroCodeForAirport("SVO")).toBe("MOW");
  expect(metroCodeForAirport("vko")).toBe("MOW");
  expect(metroCodeForAirport("LHR")).toBe("LON");
  expect(metroCodeForAirport("CIA")).toBe("ROM");
  expect(metroCodeForAirport("CGN")).toBeUndefined(); // single-airport city
  expect(METRO_BY_AIRPORT.JFK).toBe("NYC");
});
