import { afterEach, expect, test } from "bun:test";

import { handleFleetRequest } from "../src/modules/fleet";
import {
  authorizedRequest,
  config,
  installFleetFetch,
  resetFleetTestState,
} from "./fleet-test-helpers";

const originalFetch = globalThis.fetch;

afterEach(() => resetFleetTestState(originalFetch));

test("GET /fleet/purchase-preview accepts valid purchase and returns consequences", async () => {
  installFleetFetch({ aircrafts: [] });

  const request = authorizedRequest(
    "http://bff.test/fleet/purchase-preview?aircraft_type_id=type-good&base_airport_id=airport-1&tail_number=hl-001",
  );
  const response = await handleFleetRequest(request, new URL(request.url), config);
  const payload = await response?.json();

  expect(response?.status).toBe(200);
  expect(payload).toMatchObject({
    aircraftPrice: 10_000_000,
    airlineBalance: 30_000_000,
    canPurchase: true,
    remainingBalance: 20_000_000,
    tailNumber: {
      normalizedValue: "HL-001",
      suggestedPrefix: "HL",
      valid: true,
    },
  });
});

test("GET /fleet/purchase-preview blocks invalid tail number and runway mismatch", async () => {
  installFleetFetch();

  const request = authorizedRequest(
    "http://bff.test/fleet/purchase-preview?aircraft_type_id=type-good&base_airport_id=airport-short&tail_number=bad tail",
  );
  const response = await handleFleetRequest(request, new URL(request.url), config);
  const payload = await response?.json();
  const codes = payload.blockingReasons.map((reason: { code: string }) => reason.code);

  expect(response?.status).toBe(200);
  expect(payload.canPurchase).toBe(false);
  expect(codes).toContain("FLEET_TAIL_NUMBER_INVALID");
  expect(codes).toContain("FLEET_RUNWAY_TOO_SHORT");
});

test("POST /fleet/aircraft repeats preview validation before backend mutation", async () => {
  const state = { aircraftPostCalls: 0, aircrafts: [] };
  installFleetFetch(state);

  const request = purchaseRequest({
    aircraft_type_id: "type-good",
    base_airport_id: "airport-short",
    tail_number: "HL-001",
  });
  const response = await handleFleetRequest(request, new URL(request.url), config);
  const payload = await response?.json();

  expect(response?.status).toBe(400);
  expect(payload.error.code).toBe("FLEET_PURCHASE_BLOCKED");
  expect(state.aircraftPostCalls).toBe(0);
});

test("POST /fleet/aircraft calls backend once and returns enriched aircraft", async () => {
  const state = { aircraftPostCalls: 0, aircrafts: [] };
  installFleetFetch(state);

  const request = purchaseRequest({
    aircraft_type_id: "type-good",
    base_airport_id: "airport-1",
    tail_number: "hl-001",
  });
  const response = await handleFleetRequest(request, new URL(request.url), config);
  const payload = await response?.json();

  expect(response?.status).toBe(200);
  expect(state.aircraftPostCalls).toBe(1);
  expect(payload).toMatchObject({
    aircraft: {
      modelName: "Airbus A320neo",
      tail_number: "HL-001",
    },
    finance: {
      aircraftPrice: 10_000_000,
      currentBalance: 30_000_000,
      previousBalance: 30_000_000,
    },
    recommendedNextAction: {
      route: "/airports/routes",
    },
  });
});

test("POST /fleet/aircraft does not retry unsafe backend failure", async () => {
  const state = { aircraftPostCalls: 0, aircrafts: [], failAircraftPost: true };
  installFleetFetch(state);

  const response = await handleFleetRequest(
    purchaseRequest({
      aircraft_type_id: "type-good",
      base_airport_id: "airport-1",
      tail_number: "HL-001",
    }),
    new URL("http://bff.test/fleet/aircraft"),
    config,
  );
  const payload = await response?.json();

  expect(response?.status).toBe(500);
  expect(state.aircraftPostCalls).toBe(1);
  expect(payload.error.retryable).toBe(true);
});

test("PATCH /fleet/aircraft/{id}/tail-number validates conflict and normalizes success", async () => {
  const state = {
    aircrafts: [
      { id: "aircraft-1", tail_number: "HL-001", type_id: "type-good" },
      { id: "aircraft-2", tail_number: "HL-002", type_id: "type-good" },
    ],
    patchTailNumber: "",
  };
  installFleetFetch(state);

  const conflict = await handleFleetRequest(tailRequest("HL-002"), new URL(tailRequest("HL-002").url), config);
  expect(conflict?.status).toBe(409);

  const request = tailRequest("hl-003");
  const response = await handleFleetRequest(request, new URL(request.url), config);

  expect(response?.status).toBe(200);
  expect(state.patchTailNumber).toBe("HL-003");
});

function purchaseRequest(payload: Record<string, string>): Request {
  return authorizedRequest("http://bff.test/fleet/aircraft", {
    body: JSON.stringify(payload),
    method: "POST",
  });
}

function tailRequest(tailNumber: string): Request {
  return authorizedRequest("http://bff.test/fleet/aircraft/aircraft-1/tail-number", {
    body: JSON.stringify({ tail_number: tailNumber }),
    method: "PATCH",
  });
}
