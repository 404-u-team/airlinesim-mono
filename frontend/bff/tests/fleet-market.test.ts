import { afterEach, expect, test } from "bun:test";

import { handleFleetRequest } from "../src/modules/fleet";
import {
  authorizedRequest,
  config,
  defaultAircraftTypes,
  installFleetFetch,
  resetFleetTestState,
} from "./fleet-test-helpers";

const originalFetch = globalThis.fetch;

afterEach(() => resetFleetTestState(originalFetch));

test("GET /fleet/market returns normalized auth error without token", async () => {
  const request = new Request("http://bff.test/fleet/market");
  const response = await handleFleetRequest(request, new URL(request.url), config);
  const payload = await response?.json();

  expect(response?.status).toBe(401);
  expect(payload).toEqual({
    error: {
      code: "AUTH_REQUIRED",
      message: "Authentication required.",
      retryable: false,
    },
  });
});

test("GET /fleet/market enriches, filters and recommends aircraft", async () => {
  installFleetFetch({
    aircrafts: [
      {
        base_airport_id: "airport-1",
        current_maintenance_points: 80,
        id: "aircraft-1",
        max_maintenance_points_cached: 100,
        tail_number: "HL-777",
        type_id: "type-good",
      },
    ],
  });

  const request = authorizedRequest("http://bff.test/fleet/market?q=airbus&min_capacity=100&sort=recommended");
  const response = await handleFleetRequest(request, new URL(request.url), config);
  const payload = await response?.json();

  expect(response?.status).toBe(200);
  expect(payload.aircraftTypes).toHaveLength(1);
  expect(payload.aircraftTypes[0]).toMatchObject({
    compatibility: {
      canAfford: true,
      canPurchase: true,
      canUseBase: true,
      status: "recommended",
    },
    id: "type-good",
  });
  expect(payload.ownedAircraft[0]).toMatchObject({
    baseAirportName: "ICN - Incheon International",
    maintenanceRatio: 0.8,
    modelName: "Airbus A320neo",
  });
  expect(payload.summary.recommendedTypeId).toBe("type-good");
});

test("GET /fleet/market keeps blocked aircraft visible with reasons", async () => {
  installFleetFetch({
    aircraftTypes: defaultAircraftTypes(),
    airline: {
      balance: 5_000_000,
      id: "airline-1",
      starting_airport_id: "airport-short",
    },
  });

  const request = authorizedRequest("http://bff.test/fleet/market?base_airport_id=airport-short&sort=price");
  const response = await handleFleetRequest(request, new URL(request.url), config);
  const payload = await response?.json();
  const blocked = payload.aircraftTypes.find((type: { id: string }) => type.id === "type-good");

  expect(response?.status).toBe(200);
  expect(blocked.compatibility.status).toBe("blocked");
  expect(blocked.compatibility.warnings.map((warning: { code: string }) => warning.code)).toContain(
    "FLEET_RUNWAY_TOO_SHORT",
  );
  expect(blocked.compatibility.warnings.map((warning: { code: string }) => warning.code)).toContain(
    "FLEET_INSUFFICIENT_FUNDS",
  );
});

test("GET /fleet/aircraft returns product-facing empty state", async () => {
  installFleetFetch({ aircrafts: [] });

  const request = authorizedRequest("http://bff.test/fleet/aircraft");
  const response = await handleFleetRequest(request, new URL(request.url), config);
  const payload = await response?.json();

  expect(response?.status).toBe(200);
  expect(payload).toEqual({
    aircraft: [],
    emptyState: {
      code: "NO_AIRCRAFT",
      recommendedActionRoute: "/fleet/overview",
    },
  });
});

test("GET /fleet/aircraft/{id} returns enriched aircraft detail", async () => {
  installFleetFetch();

  const request = authorizedRequest("http://bff.test/fleet/aircraft/aircraft-1");
  const response = await handleFleetRequest(request, new URL(request.url), config);
  const payload = await response?.json();

  expect(response?.status).toBe(200);
  expect(payload.aircraft).toMatchObject({
    baseAirportName: "ICN - Incheon International",
    modelName: "Airbus A320neo",
    recommendedAction: {
      route: "/airports/routes",
    },
    tail_number: "HL-001",
  });
});
