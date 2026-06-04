import { expect, test } from "bun:test";

import type { ReportItem, SourceIssueSink } from "../src/modules/import/shared/types";

import { buildAircraftTypes } from "../src/modules/import/build/aircraftTypes";

test("builds real aircraft type payloads for import", () => {
  const errors: ReportItem[] = [];
  const aircraftTypes = buildAircraftTypes(issueSink(errors), {
    A20N: {
      manufacturer_id: "manufacturer-airbus",
    },
  });

  expect(errors).toHaveLength(0);
  expect(aircraftTypes.length).toBeGreaterThan(10);
  expect(aircraftTypes).toContainEqual(
    expect.objectContaining({
      payload: expect.objectContaining({
        icao_code: "A20N",
        manufacturer_id: "manufacturer-airbus",
        model_name: "Airbus A320neo",
      }),
      sourceKey: "aircraft-type:A20N",
    }),
  );
});

test("enriches curated aircraft types with observed OpenSky metadata", () => {
  const aircraftTypes = buildAircraftTypes(issueSink([]), {}, [
    { manufacturername: "Airbus", model: "A320-271N", typecode: "A20N" },
    { manufacturername: "Airbus", model: "A320-271N", typecode: "A20N" },
  ]);
  const a320 = aircraftTypes.find((item) => item.payload.icao_code === "A20N");
  const characteristics = JSON.parse(a320?.payload.characteristics ?? "{}") as {
    realWorldMetadata?: { manufacturer?: string; model?: string; observedAircraft?: number; source?: string };
  };

  expect(characteristics.realWorldMetadata).toEqual({
    manufacturer: "Airbus",
    model: "A320-271N",
    observedAircraft: 2,
    source: "OpenSky Aircraft Metadata Database",
  });
  expect(a320?.payload.max_range_km).toBe(6500);
});

function issueSink(errors: ReportItem[]): SourceIssueSink {
  return {
    error(entityType, sourceKey, message) {
      errors.push({ entityType, message, sourceKey });
    },
    skip() {},
    warn() {},
  };
}
