import { afterEach, expect, test } from "bun:test";

import type { BffConfig } from "../src/config";
import type { AirportPayload, FinalAirport, WorldData } from "../src/modules/import/shared/types";

import { planOrImport } from "../src/modules/import/runtime/importExecutor";
import { createMapping, type ReconcileState } from "../src/modules/import/runtime/mapping";
import { createReport } from "../src/modules/import/runtime/report";
import { mappingKey } from "../src/modules/import/runtime/storage";

const config: BffConfig = { backendBaseUrl: "http://backend.test", port: 4200 };
const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

test("import skips a conflicting entity and continues with the next one", async () => {
  const requests: string[] = [];
  globalThis.fetch = async (_input, init) => {
    const body = JSON.parse(String(init?.body)) as AirportPayload;
    requests.push(body.icao_code);

    if (body.icao_code === "HSWW") {
      return new Response(JSON.stringify({ error: 4 }), {
        headers: { "Content-Type": "application/json" },
        status: 409,
      });
    }

    return new Response(JSON.stringify({ id: "airport-test-id" }), {
      headers: { "Content-Type": "application/json" },
      status: 201,
    });
  };

  const state: ReconcileState = {
    backendToken: "token",
    mappings: new Map([
      [mappingKey("country", "country:SS"), createMapping("country", "country:SS", "country-id", "hash")],
      [mappingKey("region", "region:SS-EC"), createMapping("region", "region:SS-EC", "region-id", "hash")],
    ]),
  };
  const data: WorldData = {
    aircraftTypes: [],
    airports: [airport("HSWW", "WUU"), airport("TEST", "TST")],
    countries: [],
    regionLinks: [],
    regions: [],
  };
  const report = createReport("import");

  await planOrImport(config, state, data, report, "import");

  expect(requests).toEqual(["HSWW", "TEST"]);
  expect(report.counts.conflicts).toBe(1);
  expect(report.errors).toHaveLength(0);
  expect(report.skipped).toContainEqual({
    entityType: "airport",
    message: "Airport with this ICAO code already exists.",
    sourceKey: "airport:HSWW",
  });
  expect(state.mappings.get(mappingKey("airport", "airport:TEST"))?.backendId).toBe("airport-test-id");
});

function airport(icaoCode: string, iataCode: string): FinalAirport {
  return {
    capacityIndex: 1,
    countryIso: "SS",
    latitude: 0,
    longitude: 0,
    payload: {
      continent: "AF",
      country_id: "country:SS",
      elevation_ft: 0,
      fuel_price_multiplier: 1,
      gate_fee: 1,
      geog: "",
      geom: "",
      home_link: "",
      iata_code: iataCode,
      icao_code: icaoCode,
      intl_name: icaoCode,
      local_name: icaoCode,
      maintenance_point_price: 1,
      max_runway_length_m: 3_000,
      max_runway_uses_per_day: 100,
      municipality: "",
      region_id: "region:SS-EC",
      runway_fee: 1,
      stand_fee: 1,
      timezone: "Africa/Juba",
      turnaround_point_price: 1,
      wikipedia_link: "",
      works_at_night: true,
    },
    regionCode: "SS-EC",
    sourceKey: `airport:${icaoCode}`,
    type: "medium_airport",
  };
}
