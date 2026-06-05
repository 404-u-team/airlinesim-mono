import { expect, test } from "bun:test";

import { parseGeoPoint } from "../src/geo";

test("parses PostGIS EWKB hex points (live backend format)", () => {
  // JFK: lon -73.779317, lat 40.639447 as little-endian EWKB with SRID 4326.
  const point = parseGeoPoint("0101000020E6100000E10D6954E07152C03D433866D9514440");

  expect(point).not.toBeNull();
  expect(point?.longitude).toBeCloseTo(-73.779317, 4);
  expect(point?.latitude).toBeCloseTo(40.639447, 4);
});

test("parses WKB hex points without an SRID flag", () => {
  const point = parseGeoPoint("0101000000C3D32B65190E52C03D0AD7A370CD49C0");

  expect(point?.longitude).toBeCloseTo(-72.2203, 3);
  expect(point?.latitude).toBeCloseTo(-51.605, 3);
});

test("still parses WKT points (demo/seed data format)", () => {
  const point = parseGeoPoint("POINT (126.4505 37.4691)");

  expect(point?.longitude).toBeCloseTo(126.4505, 4);
  expect(point?.latitude).toBeCloseTo(37.4691, 4);
});

test("falls back to geom when geog is missing", () => {
  const point = parseGeoPoint(undefined, "POINT (2.55 49.009)");

  expect(point?.longitude).toBeCloseTo(2.55, 3);
  expect(point?.latitude).toBeCloseTo(49.009, 3);
});

test("returns null for empty or malformed geometry", () => {
  expect(parseGeoPoint("")).toBeNull();
  expect(parseGeoPoint(undefined, undefined)).toBeNull();
  expect(parseGeoPoint("not-a-point")).toBeNull();
});
