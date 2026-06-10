import { readDocument, writeDocument } from "../../db/database";

// Layer 4 — surgical per-pair demand overrides. Kept separate from the model so
// calibration never fights them and they are auditable as a list. The final
// demand is `model · multiplier`. Keyed by the ordered market pair (metro codes
// or single-airport IATA), so an override on MOW↔LED applies regardless of which
// member airports a route uses. See docs/passenger-demand-model.md "Слой 4".

export type DemandOverride = {
  multiplier: number;
  reason?: string;
  updatedAt: string;
};

export type DemandOverrideStore = Record<string, DemandOverride>;

const OVERRIDES_DOC = "demand-overrides";

export function deleteOverride(marketA: string, marketB: string): DemandOverrideStore {
  const store = loadOverrides();
  const next = { ...store };
  Reflect.deleteProperty(next, marketPairKey(marketA, marketB));
  writeDocument(OVERRIDES_DOC, next);
  return next;
}

export function getOverrideMultiplier(marketA: string, marketB: string, store = loadOverrides()): number {
  const override = store[marketPairKey(marketA, marketB)];
  if (!override || !Number.isFinite(override.multiplier) || override.multiplier <= 0) {
    return 1;
  }
  return override.multiplier;
}

export function loadOverrides(): DemandOverrideStore {
  return readDocument<DemandOverrideStore>(OVERRIDES_DOC, {});
}

// Stable key for a market pair, order-independent.
export function marketPairKey(marketA: string, marketB: string): string {
  return [marketA.toUpperCase(), marketB.toUpperCase()].sort().join("~");
}

export function setOverride(marketA: string, marketB: string, multiplier: number, reason?: string): DemandOverrideStore {
  const store = loadOverrides();
  store[marketPairKey(marketA, marketB)] = { multiplier, reason, updatedAt: new Date().toISOString() };
  writeDocument(OVERRIDES_DOC, store);
  return store;
}
