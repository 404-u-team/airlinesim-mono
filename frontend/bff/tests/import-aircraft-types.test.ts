import { expect, test } from "bun:test";

import type { ReportItem, SourceIssueSink } from "../src/modules/import/shared/types";

import { buildAircraftTypes } from "../src/modules/import/build/aircraftTypes";

test("builds real aircraft type payloads for import", () => {
  const errors: ReportItem[] = [];
  const skipped: ReportItem[] = [];
  const aircraftTypes = buildAircraftTypes(issueSink(errors, skipped), {
    A20N: {
      manufacturer_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    },
  });

  expect(errors).toHaveLength(0);
  expect(skipped).toHaveLength(0);
  expect(aircraftTypes.length).toBeGreaterThan(10);
  expect(aircraftTypes.every((item) => Boolean(item.payload.manufacturer_id))).toBe(true);
  expect(aircraftTypes.find((item) => item.payload.icao_code === "B738")?.payload.manufacturer_id)
    .toBe("11111111-1111-1111-1111-111111111111");
  expect(aircraftTypes.find((item) => item.payload.icao_code === "AT76")?.payload.manufacturer_id)
    .toBe("44444444-4444-4444-4444-444444444444");
  expect(aircraftTypes).toContainEqual(
    expect.objectContaining({
      payload: expect.objectContaining({
        icao_code: "A20N",
        manufacturer_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
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

function issueSink(errors: ReportItem[], skipped: ReportItem[] = []): SourceIssueSink {
  return {
    error(entityType, sourceKey, message) {
      errors.push({ entityType, message, sourceKey });
    },
    skip(entityType, sourceKey, message) {
      skipped.push({ entityType, message, sourceKey });
    },
    warn() {},
  };
}
