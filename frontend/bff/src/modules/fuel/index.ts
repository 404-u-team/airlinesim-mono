import type { BffConfig } from "../../config";

import { BackendHttpError } from "../../backend-http";
import { jsonResponse, readJson } from "../../http";
import { sumLedger } from "../finance/calculator";
import { listLedgerForAirline } from "../finance/storage";
import { loadFleetSnapshot } from "../fleet/snapshot";
import { FuelStorageError, getFuelStorageSnapshot, purchaseFuel } from "./fuel-storage";
import { getFuelPriceHistory, getFuelPriceSnapshot, loadFuelPriceStore, startFuelPriceScheduler } from "./price";

export async function handleFuelRequest(
  request: Request,
  url: URL,
  config: BffConfig,
): Promise<null | Response> {
  if (!url.pathname.startsWith("/fuel/")) {
    return null;
  }

  if (request.method === "GET" && url.pathname === "/fuel/price") {
    return jsonResponse(await getFuelPriceSnapshot());
  }

  if (request.method === "GET" && url.pathname === "/fuel/history") {
    return jsonResponse({ history: await getFuelPriceHistory() });
  }

  try {
    if (request.method === "GET" && url.pathname === "/fuel/storage") {
      return await storageSnapshotResponse(request, config);
    }
    if (request.method === "POST" && url.pathname === "/fuel/storage/purchase") {
      return await purchaseFuelResponse(request, config);
    }
  } catch (error) {
    return fuelErrorResponse(error);
  }

  return jsonResponse({ error: { code: "FUEL_NOT_FOUND", message: "Fuel endpoint not found." } }, { status: 404 });
}

export { closeFuelSocket, openFuelSocket } from "./websocket";
export async function initializeFuelModule(_config: BffConfig): Promise<void> {
  await loadFuelPriceStore();
  startFuelPriceScheduler();
}

function fuelErrorResponse(error: unknown): Response {
  if (error instanceof FuelStorageError) {
    return jsonResponse({ error: { code: error.code, message: error.message } }, { status: 400 });
  }
  if (error instanceof BackendHttpError) {
    return jsonResponse(error.toNormalizedJson(), { status: error.status });
  }

  return jsonResponse(
    { error: { code: "FUEL_ERROR", message: error instanceof Error ? error.message : "Fuel request failed." } },
    { status: 500 },
  );
}

async function purchaseFuelResponse(request: Request, config: BffConfig): Promise<Response> {
  const snapshot = await loadFleetSnapshot(request, config);
  const airlineId = snapshot.airline.id ?? "";
  const payload = await readJson<{ tonnes?: number }>(request);
  const tonnes = payload.tonnes ?? 0;

  const ledger = await listLedgerForAirline(airlineId);
  const available = (snapshot.airline.balance ?? 0) + sumLedger(ledger);
  const storage = await getFuelStorageSnapshot(airlineId);
  const cost = Math.round(tonnes * storage.current_price_per_tonne);
  if (Number.isFinite(tonnes) && tonnes > 0 && cost > available) {
    return jsonResponse(
      { error: { code: "FUEL_INSUFFICIENT_FUNDS", message: "Balance is not enough for this fuel purchase." } },
      { status: 402 },
    );
  }

  const result = await purchaseFuel(airlineId, tonnes);

  return jsonResponse(
    {
      cost: result.cost,
      price_per_tonne: result.price_per_tonne,
      storage: result.snapshot,
    },
    { status: 201 },
  );
}

async function storageSnapshotResponse(request: Request, config: BffConfig): Promise<Response> {
  const snapshot = await loadFleetSnapshot(request, config);

  return jsonResponse({ storage: await getFuelStorageSnapshot(snapshot.airline.id ?? "") });
}
