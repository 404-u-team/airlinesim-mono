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

function issueSink(errors: ReportItem[]): SourceIssueSink {
  return {
    error(entityType, sourceKey, message) {
      errors.push({ entityType, message, sourceKey });
    },
    skip() {},
    warn() {},
  };
}
