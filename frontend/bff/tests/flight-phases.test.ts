import { expect, test } from "bun:test";

import { cruiseFlightLevel, flightTelemetry, type TelemetryInput } from "../src/modules/operations/flight-phases";

// A 2-hour gate-to-gate flight over 1500 km with a 180-seat, 70-pax load.
const baseInput: TelemetryInput = {
  arrivalAt: "2026-06-10T12:00:00.000Z",
  cruiseSpeedKph: 820,
  departureAt: "2026-06-10T10:00:00.000Z",
  distanceKm: 1500,
  fuelBurnKgPerHour: 2400,
  passengers: 70,
};

function at(iso: string) {
  return flightTelemetry(baseInput, new Date(iso));
}

test("cruise flight level rises with stage length", () => {
  expect(cruiseFlightLevel(300)).toBeLessThan(cruiseFlightLevel(1000));
  expect(cruiseFlightLevel(1000)).toBeLessThan(cruiseFlightLevel(5000));
  expect(cruiseFlightLevel(5000)).toBe(390);
});

test("phases progress in order across the flight", () => {
  expect(at("2026-06-10T09:00:00.000Z").phase).toBe("scheduled");
  expect(at("2026-06-10T09:45:00.000Z").phase).toBe("boarding");
  expect(at("2026-06-10T10:02:00.000Z").phase).toBe("taxi_out");
  expect(at("2026-06-10T11:00:00.000Z").phase).toBe("cruise");
  expect(at("2026-06-10T12:05:00.000Z").phase).toBe("deplaning");
  expect(at("2026-06-10T13:00:00.000Z").phase).toBe("arrived");
});

test("altitude climbs to cruise FL and returns to ground", () => {
  expect(at("2026-06-10T10:02:00.000Z").altitude_ft).toBe(0);
  expect(at("2026-06-10T11:00:00.000Z").altitude_ft).toBe(36_000);
  expect(at("2026-06-10T13:00:00.000Z").altitude_ft).toBe(0);
});

test("ground speed peaks at cruise and is zero before pushback", () => {
  expect(at("2026-06-10T09:45:00.000Z").ground_speed_kph).toBe(0);
  expect(at("2026-06-10T11:00:00.000Z").ground_speed_kph).toBe(820);
});

test("fuel on board decreases monotonically while airborne", () => {
  const early = at("2026-06-10T10:20:00.000Z").fuel_remaining_t;
  const mid = at("2026-06-10T11:00:00.000Z").fuel_remaining_t;
  const late = at("2026-06-10T11:50:00.000Z").fuel_remaining_t;

  expect(early).toBeGreaterThan(mid);
  expect(mid).toBeGreaterThan(late);
  expect(late).toBeGreaterThan(0);
});

test("passengers board, ride full, then deplane", () => {
  expect(at("2026-06-10T09:00:00.000Z").passengers_on_board).toBe(0);
  expect(at("2026-06-10T11:00:00.000Z").passengers_on_board).toBe(70);
  expect(at("2026-06-10T12:07:30.000Z").passengers_on_board).toBeLessThan(70);
  expect(at("2026-06-10T13:00:00.000Z").passengers_on_board).toBe(0);
});

test("air progress drives map interpolation from 0 to 1", () => {
  expect(at("2026-06-10T10:02:00.000Z").air_progress).toBe(0);
  expect(at("2026-06-10T12:00:00.000Z").air_progress).toBe(1);
  const mid = at("2026-06-10T11:00:00.000Z").air_progress;
  expect(mid).toBeGreaterThan(0.3);
  expect(mid).toBeLessThan(0.7);
});

test("degenerate times yield a safe scheduled telemetry", () => {
  const telemetry = flightTelemetry({ ...baseInput, arrivalAt: baseInput.departureAt });
  expect(telemetry.phase).toBe("scheduled");
  expect(telemetry.ground_speed_kph).toBe(0);
});
