/* eslint-disable @typescript-eslint/require-await -- storage API is async by contract over a synchronous SQLite store. */

// Airline fuel storage: the player can buy jet fuel ahead at the current market price
// and flights then burn from the tank first, spot-buying only the shortfall. The tank
// is a single global facility with a fixed (deliberately large) capacity for the MVP.

import type { LedgerTransaction } from "../finance/types";

import { readDocument, writeDocument } from "../../db/database";
import { saveLedgerTransactions } from "../finance/storage";
import { getCurrentFuelUnitPrice } from "./price";

export const FUEL_STORAGE_CAPACITY_TONNES = 100_000;
const HISTORY_LIMIT = 500;

export type FuelConsumption = {
  from_storage_tonnes: number;
  spot_price_per_tonne: number;
  spot_tonnes: number;
};

export type FuelStorageHistoryEntry = {
  change_tonnes: number;
  price_per_tonne?: number;
  reason: "consumption" | "purchase";
  recorded_at: string;
  stored_tonnes: number;
};

export type FuelStorageSnapshot = {
  average_purchase_price: null | number;
  capacity_tonnes: number;
  current_price_per_tonne: number;
  history: FuelStorageHistoryEntry[];
  stored_tonnes: number;
  updated_at: string;
};

export type FuelStorageState = {
  airline_id: string;
  capacity_tonnes: number;
  // Idempotency journal: per-flight drawdown already applied, so repeated settlement
  // passes reuse the recorded split instead of double-consuming.
  consumed_flights: Record<string, FuelConsumption>;
  history: FuelStorageHistoryEntry[];
  stored_tonnes: number;
  total_purchase_cost: number;
  total_purchased_tonnes: number;
  updated_at: string;
};

export class FuelStorageError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

// Draws each flight's fuel from the tank (idempotent per flight id) and reports how
// much still has to be bought on the spot market at the current price. One storage
// read/write per batch, regardless of how many flights settle at once.
export async function consumeFuelForFlights(
  airlineId: string,
  requests: Array<{ flightId: string; tonnes: number }>,
): Promise<Map<string, FuelConsumption>> {
  const state = readState(airlineId);
  const results = new Map<string, FuelConsumption>();
  const now = new Date().toISOString();
  let drawnTotal = 0;
  let changed = false;

  for (const { flightId, tonnes } of requests) {
    const existing = state.consumed_flights[flightId];
    if (existing) {
      results.set(flightId, existing);
      continue;
    }

    const needed = Math.max(0, tonnes);
    const fromStorage = Math.min(state.stored_tonnes, needed);
    const consumption: FuelConsumption = {
      from_storage_tonnes: round3(fromStorage),
      spot_price_per_tonne: getCurrentFuelUnitPrice(),
      spot_tonnes: round3(needed - fromStorage),
    };

    state.consumed_flights[flightId] = consumption;
    state.stored_tonnes = round3(state.stored_tonnes - fromStorage);
    drawnTotal += fromStorage;
    changed = true;
    results.set(flightId, consumption);
  }

  if (changed) {
    state.updated_at = now;
    if (drawnTotal > 0) {
      pushHistory(state, {
        change_tonnes: -round3(drawnTotal),
        reason: "consumption",
        recorded_at: now,
        stored_tonnes: state.stored_tonnes,
      });
    }
    writeState(state);
  }

  return results;
}

export async function getFuelStorageSnapshot(airlineId: string): Promise<FuelStorageSnapshot> {
  const state = readState(airlineId);

  return {
    average_purchase_price: state.total_purchased_tonnes > 0
      ? Math.round(state.total_purchase_cost / state.total_purchased_tonnes)
      : null,
    capacity_tonnes: state.capacity_tonnes,
    current_price_per_tonne: getCurrentFuelUnitPrice(),
    history: state.history,
    stored_tonnes: state.stored_tonnes,
    updated_at: state.updated_at,
  };
}

export async function purchaseFuel(airlineId: string, tonnes: number): Promise<{
  cost: number;
  price_per_tonne: number;
  snapshot: FuelStorageSnapshot;
  transaction: LedgerTransaction;
}> {
  if (!Number.isFinite(tonnes) || tonnes <= 0) {
    throw new FuelStorageError("FUEL_INVALID_AMOUNT", "Fuel amount must be a positive number of tonnes.");
  }

  const state = readState(airlineId);
  const freeCapacity = state.capacity_tonnes - state.stored_tonnes;
  if (tonnes > freeCapacity) {
    throw new FuelStorageError("FUEL_STORAGE_FULL", `Storage can take only ${String(Math.floor(freeCapacity))} more tonnes.`);
  }

  const price = getCurrentFuelUnitPrice();
  const cost = Math.round(tonnes * price);
  const now = new Date().toISOString();

  state.stored_tonnes = round3(state.stored_tonnes + tonnes);
  state.total_purchase_cost += cost;
  state.total_purchased_tonnes = round3(state.total_purchased_tonnes + tonnes);
  state.updated_at = now;
  pushHistory(state, {
    change_tonnes: round3(tonnes),
    price_per_tonne: price,
    reason: "purchase",
    recorded_at: now,
    stored_tonnes: state.stored_tonnes,
  });
  writeState(state);

  const [transaction] = await saveLedgerTransactions([fuelPurchaseTransaction(airlineId, tonnes, price, cost, now)]);

  return {
    cost,
    price_per_tonne: price,
    snapshot: await getFuelStorageSnapshot(airlineId),
    transaction: transaction ?? fuelPurchaseTransaction(airlineId, tonnes, price, cost, now),
  };
}

function fuelPurchaseTransaction(
  airlineId: string,
  tonnes: number,
  price: number,
  cost: number,
  now: string,
): LedgerTransaction {
  return {
    airline_id: airlineId,
    amount: cost,
    category: "fuel",
    created_at: now,
    currency: "USD",
    direction: "debit",
    id: `ledger-${crypto.randomUUID()}`,
    idempotency_key: `fuel-purchase:${airlineId}:${crypto.randomUUID()}`,
    label_code: "FINANCE_FUEL_PURCHASE",
    occurred_at: now,
    parameters: { price_per_tonne: price, tonnes: round3(tonnes) },
    source_type: "fuel_purchase",
  };
}

function pushHistory(state: FuelStorageState, entry: FuelStorageHistoryEntry): void {
  state.history = [entry, ...state.history].slice(0, HISTORY_LIMIT);
}

function readState(airlineId: string): FuelStorageState {
  const all = readDocument<Record<string, FuelStorageState>>("fuel-storage", {});
  const state = all[airlineId];

  if (state) {
    return { ...state, capacity_tonnes: FUEL_STORAGE_CAPACITY_TONNES };
  }

  return {
    airline_id: airlineId,
    capacity_tonnes: FUEL_STORAGE_CAPACITY_TONNES,
    consumed_flights: {},
    history: [],
    stored_tonnes: 0,
    total_purchase_cost: 0,
    total_purchased_tonnes: 0,
    updated_at: new Date().toISOString(),
  };
}

function round3(value: number): number {
  return Number(value.toFixed(3));
}

function writeState(state: FuelStorageState): void {
  const all = readDocument<Record<string, FuelStorageState>>("fuel-storage", {});
  writeDocument("fuel-storage", { ...all, [state.airline_id]: state });
}
