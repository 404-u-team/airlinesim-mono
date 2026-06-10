import type { BffConfig } from "../../config";
import type { Aircraft, Airline, PurchasePayload } from "./types";

import { getUserAuthorization } from "../../auth";
import { requestBackendJson } from "../../backend-http";
import { jsonResponse, readJson } from "../../http";
import { recordGameEvent } from "../events/producer";
import { reconcileNotificationsAfterMutation } from "../events/reconcile";
import { sumLedger } from "../finance/calculator";
import { listLedgerForAirline } from "../finance/storage";
import { cache } from "../proxy";
import { buildPurchasePreview } from "./preview";
import { enrichOwnedAircraft } from "./scoring";
import { getCountryForAirport, loadFleetSnapshot } from "./snapshot";
import { normalizeTailNumber, validateTailNumber } from "./tail-number";

export async function getAircraftDetail(
  request: Request,
  config: BffConfig,
  aircraftId: string,
): Promise<Record<string, unknown>> {
  const authorization = getUserAuthorization(request) ?? "";
  const [snapshot, aircraft] = await Promise.all([
    loadFleetSnapshot(request, config),
    requestBackendJson<Aircraft>(config, `/aircraft/${encodeURIComponent(aircraftId)}`, { token: authorization }),
  ]);

  return {
    aircraft: enrichOwnedAircraft(aircraft, snapshot.aircraftTypes, snapshot.airports),
  };
}

export async function getOwnedFleet(request: Request, config: BffConfig): Promise<Record<string, unknown>> {
  const snapshot = await loadFleetSnapshot(request, config);
  const aircraft = snapshot.aircrafts.map((item) => enrichOwnedAircraft(item, snapshot.aircraftTypes, snapshot.airports));

  return {
    aircraft,
    emptyState: aircraft.length === 0 ? getEmptyFleetState() : null,
  };
}

export async function handlePurchaseAircraft(request: Request, config: BffConfig): Promise<Response> {
  const authorization = getUserAuthorization(request) ?? "";
  const payload = await readJson<PurchasePayload>(request);
  const snapshot = await loadFleetSnapshot(request, config);
  const preview = buildPurchasePreview(
    snapshot,
    payload.aircraft_type_id ?? "",
    payload.base_airport_id ?? "",
    payload.tail_number ?? "",
  );

  if (!preview.canPurchase) {
    return blockedPurchaseResponse(preview.blockingReasons);
  }

  const response = await requestBackendJson<{ id?: string }>(config, "/aircraft", {
    body: getPurchasePayload(payload, preview.tailNumber.normalizedValue),
    maxAttempts: 1,
    method: "POST",
    token: authorization,
  });

  cache.clear();

  const purchaseResponse = await buildPurchaseResponse(config, authorization, snapshot, response.id, preview);
  await recordPurchasedAircraftEvent(snapshot, response.id, preview);
  await reconcileNotificationsAfterMutation(request, config);

  return jsonResponse(purchaseResponse);
}

export async function handleUpdateTailNumber(request: Request, config: BffConfig, aircraftId: string): Promise<Response> {
  const authorization = getUserAuthorization(request) ?? "";
  const payload = await readJson<{ tail_number?: string }>(request);
  const snapshot = await loadFleetSnapshot(request, config);
  const validation = validateTailNumber(
    payload.tail_number,
    snapshot.aircrafts,
    getCountryForAirport(snapshot, snapshot.airline.starting_airport_id),
    aircraftId,
  );

  if (!validation.valid) {
    return invalidTailNumberResponse(validation);
  }

  await requestBackendJson(config, `/aircraft/${encodeURIComponent(aircraftId)}`, {
    body: {
      tail_number: validation.normalizedValue,
    },
    maxAttempts: 1,
    method: "PATCH",
    token: authorization,
  });

  return jsonResponse(await getAircraftDetail(request, config, aircraftId));
}

function blockedPurchaseResponse(reasons: unknown[]): Response {
  return jsonResponse(
    {
      error: {
        code: "FLEET_PURCHASE_BLOCKED",
        message: "Aircraft cannot be purchased with the current selection.",
        reasons,
        retryable: false,
      },
    },
    { status: 400 },
  );
}

async function buildPurchaseResponse(
  config: BffConfig,
  authorization: string,
  snapshot: Awaited<ReturnType<typeof loadFleetSnapshot>>,
  aircraftId: string | undefined,
  preview: ReturnType<typeof buildPurchasePreview>,
): Promise<Record<string, unknown>> {
  const [currentAirline, createdAircraft] = await Promise.all([
    requestBackendJson<Airline>(config, "/airline/me", { token: authorization }),
    getCreatedAircraft(config, authorization, aircraftId, preview.tailNumber.normalizedValue),
  ]);

  const ledger = await listLedgerForAirline(snapshot.airline.id ?? "");
  const ledgerDelta = sumLedger(ledger);
  const currentAvailableBalance = (currentAirline.balance ?? 0) + ledgerDelta;

  return {
    aircraft: createdAircraft ? enrichOwnedAircraft(createdAircraft, snapshot.aircraftTypes, snapshot.airports) : null,
    event: {
      severity: "success",
      title: "Aircraft purchased",
      type: "AIRCRAFT_PURCHASED",
    },
    finance: {
      aircraftPrice: preview.aircraftPrice,
      currentBalance: currentAvailableBalance,
      previousBalance: snapshot.airline.balance ?? 0,
    },
    recommendedNextAction: {
      labelKey: "fleet.next.planRoute",
      route: "/airports/routes",
    },
    snapshot: {
      ownedAircraft: createdAircraft ? snapshot.aircrafts.length + 1 : snapshot.aircrafts.length,
    },
  };
}

async function findAircraftByTailNumber(
  config: BffConfig,
  authorization: string,
  tailNumber: string,
): Promise<Aircraft | null> {
  const response = await requestBackendJson<{ items?: Aircraft[] }>(config, "/aircrafts", { token: authorization });

  return response.items?.find((aircraft) => normalizeTailNumber(aircraft.tail_number) === tailNumber) ?? null;
}

async function getCreatedAircraft(
  config: BffConfig,
  authorization: string,
  aircraftId: string | undefined,
  tailNumber: string,
): Promise<Aircraft | null> {
  if (aircraftId) {
    return requestBackendJson<Aircraft>(config, `/aircraft/${encodeURIComponent(aircraftId)}`, { token: authorization });
  }

  return findAircraftByTailNumber(config, authorization, tailNumber);
}

function getEmptyFleetState(): Record<string, string> {
  return {
    code: "NO_AIRCRAFT",
    recommendedActionRoute: "/fleet/overview",
  };
}

function getPurchasePayload(payload: PurchasePayload, tailNumber: string): PurchasePayload {
  return {
    aircraft_type_id: payload.aircraft_type_id,
    base_airport_id: payload.base_airport_id,
    tail_number: tailNumber,
  };
}

function invalidTailNumberResponse(validation: ReturnType<typeof validateTailNumber>): Response {
  return jsonResponse(
    {
      error: {
        code: validation.conflict ? "FLEET_TAIL_NUMBER_EXISTS" : "FLEET_TAIL_NUMBER_INVALID",
        message: validation.message ?? "Invalid tail number.",
        retryable: false,
      },
    },
    { status: validation.conflict ? 409 : 400 },
  );
}

async function recordPurchasedAircraftEvent(
  snapshot: Awaited<ReturnType<typeof loadFleetSnapshot>>,
  aircraftId: string | undefined,
  preview: ReturnType<typeof buildPurchasePreview>,
): Promise<void> {
  const sourceId = aircraftId ?? preview.tailNumber.normalizedValue;
  await recordGameEvent({
    airline_id: snapshot.airline.id ?? "",
    category: "fleet",
    code: "AIRCRAFT_PURCHASED",
    dedupe_key: `aircraft-purchased:${sourceId}`,
    occurred_at: new Date().toISOString(),
    parameters: {
      base_airport_code: preview.baseAirport?.iata_code ?? preview.baseAirport?.icao_code ?? "",
      model: preview.aircraftType?.model_name ?? "",
      price: preview.aircraftPrice,
      remaining_balance: preview.remainingBalance,
      tail_number: preview.tailNumber.normalizedValue,
    },
    related: { aircraft_id: aircraftId },
    severity: "success",
    source_id: sourceId,
    source_type: "aircraft",
    target_path: "/fleet/aircraft",
  });
}
