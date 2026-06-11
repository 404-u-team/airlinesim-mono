import { expect, test } from "bun:test";

import {
  captureShare,
  expectedPassengersPerFlight,
  MAX_LOAD_FACTOR,
  referenceFare,
} from "../src/modules/operations/passenger-load";

test("capture share grows with frequency and saturates below 1", () => {
  expect(captureShare(3)).toBeGreaterThan(0.4);
  expect(captureShare(3)).toBeLessThan(0.55);
  expect(captureShare(7)).toBeGreaterThan(captureShare(3));
  expect(captureShare(14)).toBeGreaterThan(0.9);
  expect(captureShare(14)).toBeLessThan(1);
});

test("thin market yields an honestly low load factor (no 35% floor)", () => {
  const seats = 180;
  const passengers = expectedPassengersPerFlight({
    dailyDemand: 20,
    distanceKm: 800,
    fare: referenceFare(800),
    flightsPerWeek: 7,
    seats,
  });

  expect(passengers / seats).toBeLessThan(0.2);
  expect(passengers).toBeGreaterThan(0);
});

test("overflowing demand is capped at the max load factor (spill)", () => {
  const seats = 180;
  const passengers = expectedPassengersPerFlight({
    dailyDemand: 50_000,
    distanceKm: 800,
    fare: referenceFare(800),
    flightsPerWeek: 7,
    seats,
  });

  expect(passengers).toBe(Math.round(seats * MAX_LOAD_FACTOR));
});

test("a higher fare suppresses demand (price elasticity)", () => {
  const base = { dailyDemand: 150, distanceKm: 1200, flightsPerWeek: 7, seats: 180 };
  const cheap = expectedPassengersPerFlight({ ...base, fare: referenceFare(1200) });
  const pricey = expectedPassengersPerFlight({ ...base, fare: referenceFare(1200) * 1.5 });

  expect(pricey).toBeLessThan(cheap);
});

test("reference fare rises with distance", () => {
  expect(referenceFare(2000)).toBeGreaterThan(referenceFare(300));
  expect(referenceFare(0)).toBe(55);
});
