import { expect, test } from "bun:test";

import type { ReportItem, SourceIssueSink } from "../src/modules/import/shared/types";
import type { RawSources } from "../src/modules/import/runtime/sources";

import { buildAircraftTypes } from "../src/modules/import/build/aircraftTypes";

const mockRawSources: RawSources = {
  openapAircraftYamlFiles: [
    {
      filename: "a20n.yml",
      content: `
aircraft: "Airbus A320-271N"
pax:
  max: 180
cruise:
  range: 6200
  mach: 0.78
  height: 11000
mass:
  max: 79000
runway:
  length: 1500
engine:
  default: "LEAP-1A26"
`
    },
    {
      filename: "b738.yml",
      content: `
aircraft: "Boeing 737-800"
pax:
  max: 189
cruise:
  range: 5765
  mach: 0.785
  height: 11000
mass:
  max: 79016
runway:
  length: 2000
engine:
  default: "CFM56-7B26"
`
    },
    {
      filename: "at76.yml",
      content: `
aircraft: "ATR 72-600"
pax:
  max: 78
cruise:
  range: 1528
  speed: 141.67 # speed in m/s roughly matching 510 kph
mass:
  max: 23000
runway:
  length: 1050
engine:
  default: "PW127M"
`
    }
  ],
  openflightsPlanes: [
    "Airbus A320-271N,32N,A20N",
    "Boeing 737-800,738,B738",
    "ATR 72-600,AT7,AT76"
  ].join("\n"),
  openapSynonyms: "",
  openapFuel: "",
  openapEngines: "",
  airports: [],
  countries: [],
  geoAdmin1: new Map(),
  geoCities: [],
  manual: { aircraftTypes: {}, airports: {}, countries: {}, regions: {} },
  regions: [],
  restCountries: new Map(),
  runways: [],
  worldBankCountries: new Map(),
  worldBankGdp: new Map(),
  worldBankPopulation: new Map(),
  worldBankTourism: new Map(),
};

test("builds aircraft type payloads from OpenSky metadata rows", async () => {
  const errors: ReportItem[] = [];
  const skipped: ReportItem[] = [];
  const aircraftTypes = await buildAircraftTypes(issueSink(errors, skipped), {
    A20N: {
      iata_code: "32N",
      manufacturer_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    },
  }, mockRawSources);

  expect(errors).toHaveLength(0);
  expect(skipped).toHaveLength(0);
  expect(aircraftTypes).toHaveLength(3);
  expect(aircraftTypes.every((item) => Boolean(item.payload.manufacturer_id))).toBe(true);
  expect(aircraftTypes.find((item) => item.payload.icao_code === "B738")?.payload.manufacturer_id)
    .toBe("11111111-1111-1111-1111-111111111111");
  expect(aircraftTypes.find((item) => item.payload.icao_code === "AT76")?.payload.manufacturer_id)
    .toBe("44444444-4444-4444-4444-444444444444");
  expect(aircraftTypes).toContainEqual(
    expect.objectContaining({
      payload: expect.objectContaining({
        iata_code: "32N",
        icao_code: "A20N",
        manufacturer_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
        model_name: "Airbus A320-271N",
      }),
      sourceKey: "aircraft-type:A20N",
    }),
  );
});

test("enriches generated aircraft types with observed OpenSky metadata", async () => {
  const mockRawSourcesEnrich: RawSources = {
    ...mockRawSources,
    openapAircraftYamlFiles: [
      {
        filename: "a20n.yml",
        content: `
aircraft: "Airbus A320-271N"
pax:
  max: 180
cruise:
  range: 6200
  mach: 0.78
  height: 11000
mass:
  max: 79000
runway:
  length: 1500
engine:
  default: "LEAP-1A26"
`
      }
    ],
  };
  const aircraftTypes = await buildAircraftTypes(issueSink([]), {}, mockRawSourcesEnrich);
  const a320 = aircraftTypes.find((item) => item.payload.icao_code === "A20N");
  const characteristics = JSON.parse(a320?.payload.characteristics ?? "{}") as {
    realWorldMetadata?: { manufacturer?: string; model?: string; source?: string };
  };

  expect(characteristics.realWorldMetadata).toEqual({
    manufacturer: "Airbus",
    model: "A320-271N",
    source: "OpenAP / OpenFlights",
  });
  expect(a320?.payload.max_range_km).toBe(6200);
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
