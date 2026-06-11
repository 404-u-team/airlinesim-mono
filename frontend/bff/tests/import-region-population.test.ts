import { expect, test } from "bun:test";

import type { GeoCity, RegionRow } from "../src/modules/import/runtime/sources";

import { cityPopulationShares } from "../src/modules/import/build/shared";

function city(admin1Code: string, population: number, name: string): GeoCity {
  return { admin1Code, countryCode: "RU", latitude: 0, longitude: 0, name, population, timezone: "Europe/Moscow" };
}

function regionRow(code: string, name: string): RegionRow {
  return { code, name };
}

// Russia: OurAirports ISO-3166-2 codes are alphabetic (RU-MOW) but GeoNames admin1
// codes are numeric (48), so the old direct `RU-<admin1>` match never hit and dense
// metros collapsed to the airport-weight fallback (the Moscow ~1M bug).
test("cityPopulationShares resolves numeric GeoNames admin1 codes to ISO regions by name", () => {
  const cities = [
    city("48", 12_000_000, "Moscow"),
    city("66", 5_000_000, "Saint Petersburg"),
  ];
  const geoAdmin1 = new Map([
    ["RU.48", "moscow"],
    ["RU.66", "saint petersburg"],
  ]);
  const regionRows = new Map([
    // OurAirports names federal cities with a "(city)" qualifier that GeoNames omits.
    ["RU-MOW", regionRow("RU-MOW", "Moscow (city)")],
    ["RU-SPE", regionRow("RU-SPE", "Saint Petersburg (city)")],
  ]);

  const shares = cityPopulationShares(cities, "RU", ["RU-MOW", "RU-SPE"], geoAdmin1, regionRows);

  expect(shares.get("RU-MOW")).toBeCloseTo(12 / 17, 5);
  expect(shares.get("RU-SPE")).toBeCloseTo(5 / 17, 5);
});

// Turkey: ISO-3166-2 codes are numeric (TR-34) and equal the GeoNames admin1 code,
// so the direct match must still work without any name crosswalk.
test("cityPopulationShares still matches countries whose ISO codes equal admin1 codes", () => {
  const istanbul: GeoCity = { admin1Code: "34", countryCode: "TR", latitude: 0, longitude: 0, name: "Istanbul", population: 15_000_000, timezone: "Europe/Istanbul" };
  const shares = cityPopulationShares([istanbul], "TR", ["TR-34"], new Map(), new Map());

  expect(shares.get("TR-34")).toBeCloseTo(1, 5);
});
