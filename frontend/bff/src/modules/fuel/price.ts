import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

export type FuelPriceEventPayload = {
  price?: number;
  recorded_at?: string;
};

export type FuelPriceSnapshot = {
  price: number;
  recorded_at: string;
  source: "fallback" | "internal" | "storage";
  unit_price: number;
  updated_at: string;
};

type FuelPriceStore = {
  current: FuelPriceSnapshot;
  history: FuelPriceSnapshot[];
};

// The fuel price is a self-contained simulation, independent of the backend. It is
// expressed in USD per tonne of jet fuel (a realistic ~800/t). Aircraft
// fuel_consumption_per_hour is in kg/h, so cost callers divide consumption by 1000.
const defaultFuelPricePerTonne = 820;
const minFuelPricePerTonne = 560;
const maxFuelPricePerTonne = 1180;
const fuelUpdateIntervalMs = 15 * 60 * 1000;
const historyLimit = 96;
const storePath = resolve(import.meta.dir, "../../../data/game-state/fuel-price.json");

let currentSnapshot: FuelPriceSnapshot = buildFallbackSnapshot();
let mutationQueue: Promise<unknown> = Promise.resolve();
let schedulerTimer: null | ReturnType<typeof setInterval> = null;

export async function advanceFuelPrice(): Promise<FuelPriceSnapshot> {
  const nextPrice = nextRandomWalkPrice(currentSnapshot.price);

  return (await recordFuelPriceChange({ price: nextPrice, recorded_at: new Date().toISOString() })) ?? currentSnapshot;
}

export function getCurrentFuelUnitPrice(): number {
  return currentSnapshot.unit_price;
}

export async function getFuelPriceHistory(): Promise<FuelPriceSnapshot[]> {
  const store = await loadFuelPriceStore();

  return store.history;
}

export async function getFuelPriceSnapshot(): Promise<FuelPriceSnapshot> {
  await loadFuelPriceStore();

  return currentSnapshot;
}

export async function loadFuelPriceStore(): Promise<FuelPriceStore> {
  const store = await readFuelPriceStoreFromDisk();
  currentSnapshot = store.current;

  return store;
}

export async function recordFuelPriceChange(payload: FuelPriceEventPayload): Promise<FuelPriceSnapshot | null> {
  if (!isValidFuelPrice(payload.price)) {
    return null;
  }

  const recordedAt = normalizeRecordedAt(payload.recorded_at);
  const snapshot = buildSnapshot(payload.price, recordedAt, "internal");
  currentSnapshot = snapshot;

  await queuedMutation(async () => {
    const store = await readFuelPriceStoreFromDisk();
    const history = dedupeHistory([snapshot, ...store.history]);
    await writeFuelPriceStore({
      current: snapshot,
      history: history.slice(0, historyLimit),
    });
    currentSnapshot = snapshot;
  });

  return snapshot;
}

export function startFuelPriceScheduler(): void {
  if (schedulerTimer) {
    return;
  }

  schedulerTimer = setInterval(() => void advanceFuelPrice(), fuelUpdateIntervalMs);
  schedulerTimer.unref();
}

function buildFallbackSnapshot(): FuelPriceSnapshot {
  return buildSnapshot(defaultFuelPricePerTonne, new Date().toISOString(), "fallback");
}

function buildSnapshot(
  price: number,
  recordedAt: string,
  source: FuelPriceSnapshot["source"],
): FuelPriceSnapshot {
  const perTonne = clampFuelPrice(price);

  return {
    price: perTonne,
    recorded_at: recordedAt,
    source,
    unit_price: perTonne,
    updated_at: new Date().toISOString(),
  };
}

function clampFuelPrice(price: number): number {
  return Math.round(Math.max(minFuelPricePerTonne, Math.min(maxFuelPricePerTonne, price)));
}

function dedupeHistory(history: FuelPriceSnapshot[]): FuelPriceSnapshot[] {
  const seen = new Set<string>();
  const deduped: FuelPriceSnapshot[] = [];

  for (const item of history) {
    const key = `${item.recorded_at}:${String(item.price)}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    deduped.push(item);
  }

  return deduped;
}

function isValidFuelPrice(value: number | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function nextRandomWalkPrice(previous: number): number {
  const meanReversion = (defaultFuelPricePerTonne - previous) * 0.05;
  const shock = (Math.random() - 0.5) * 0.08 * previous;

  return clampFuelPrice(previous + meanReversion + shock);
}

function normalizeRecordedAt(value: string | undefined): string {
  if (!value) {
    return new Date().toISOString();
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function normalizeSnapshot(value: unknown, source: FuelPriceSnapshot["source"]): FuelPriceSnapshot | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const payload = value as Partial<FuelPriceSnapshot>;
  if (!isValidFuelPrice(payload.price)) {
    return null;
  }

  const perTonne = clampFuelPrice(payload.price);

  return {
    price: perTonne,
    recorded_at: normalizeRecordedAt(payload.recorded_at),
    source,
    unit_price: perTonne,
    updated_at: normalizeRecordedAt(payload.updated_at),
  };
}

function normalizeStore(value: unknown): FuelPriceStore {
  const payload = value && typeof value === "object"
    ? value as { current?: unknown; history?: unknown }
    : {};
  const current = normalizeSnapshot(payload.current, "storage") ?? currentSnapshot;
  const history = Array.isArray(payload.history)
    ? payload.history
      .map((item) => normalizeSnapshot(item, "storage"))
      .filter((item): item is FuelPriceSnapshot => Boolean(item))
    : [];

  return {
    current,
    history: dedupeHistory([current, ...history]).slice(0, historyLimit),
  };
}

async function queuedMutation<TValue>(mutation: () => Promise<TValue>): Promise<TValue> {
  const next = mutationQueue.then(mutation, mutation);
  mutationQueue = next.catch(() => undefined);

  return next;
}

async function readFuelPriceStoreFromDisk(): Promise<FuelPriceStore> {
  try {
    const raw = await readFile(storePath, "utf8");
    return normalizeStore(JSON.parse(raw) as unknown);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      const fallback = buildFallbackSnapshot();

      return { current: fallback, history: [fallback] };
    }
    throw error;
  }
}

async function writeFuelPriceStore(store: FuelPriceStore): Promise<void> {
  await mkdir(dirname(storePath), { recursive: true });

  const tmpPath = `${storePath}.${crypto.randomUUID()}.tmp`;
  await writeFile(tmpPath, JSON.stringify(store, null, 2));
  await rename(tmpPath, storePath);
}
