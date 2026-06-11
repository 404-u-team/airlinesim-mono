import { expect, test } from "bun:test";

import type { AircraftType, Airport } from "../src/modules/fleet/types";
import type { RouteDemandSnapshot } from "../src/modules/routes/types";

import { buildRouteEconomics } from "../src/modules/routes/economics";
import { referenceFare } from "../src/modules/operations/passenger-load";

test("a higher fare override raises per-passenger fare but lowers the load factor", () => {
  const reference = buildRouteEconomics(demand(), type(), airport(), airport());
  const pricey = buildRouteEconomics(demand(), type(), airport(), airport(), referenceFare(1200) * 1.5);

  expect(pricey.estimated_fare_per_passenger).toBeGreaterThan(reference.estimated_fare_per_passenger);
  expect(pricey.expected_load_factor).toBeLessThan(reference.expected_load_factor);
});

test("the default fare matches the distance-based reference fare", () => {
  const economics = buildRouteEconomics(demand(), type(), airport(), airport());

  expect(economics.estimated_fare_per_passenger).toBe(Math.round(referenceFare(1200)));
});

function airport(): Airport {
  return { gate_fee: 100, runway_fee: 200, stand_fee: 50 } as Airport;
}

function demand(): RouteDemandSnapshot {
  return {
    calculated_at: new Date().toISOString(),
    destination_daily_passengers: 140,
    distance_km: 1200,
    origin_daily_passengers: 140,
  };
}

function type(): AircraftType {
  return {
    cruising_speed_kph: 800,
    fuel_consumption_per_hour: 2400,
    maint_cost_per_flight_hour: 600,
    max_planned_seat_capacity: 180,
  } as AircraftType;
}
