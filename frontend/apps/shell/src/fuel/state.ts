import { createRealtimeClient, type FuelPriceChangedEvent } from "@airlinesim/game-sdk/realtime";
import { computed, ref, type Ref } from "vue";

import type { FuelPriceSnapshot } from "./types";

import { getFuelPrice } from "./api";

type FuelConnectionState = "connected" | "connecting" | "disconnected";

const current = ref<FuelPriceSnapshot | null>(null);
const error = ref("");
const isLoading = ref(false);
const connectionState = ref<FuelConnectionState>("disconnected");
let realtimeSocket: null | ReturnType<typeof createRealtimeClient> = null;

export const fuelState: {
  connectionState: Ref<FuelConnectionState>;
  current: Ref<FuelPriceSnapshot | null>;
  error: Ref<string>;
  isLive: Ref<boolean>;
  isLoading: Ref<boolean>;
} = {
  connectionState,
  current,
  error,
  isLive: computed(() => connectionState.value === "connected"),
  isLoading,
};

export async function refreshFuelPrice(): Promise<void> {
  isLoading.value = true;
  error.value = "";

  try {
    current.value = await getFuelPrice();
  } catch (loadError) {
    error.value = loadError instanceof Error ? loadError.message : "Could not load fuel price.";
  } finally {
    isLoading.value = false;
  }
}

export function startFuelRealtime(getToken: () => null | string): void {
  if (realtimeSocket) {
    return;
  }

  connectionState.value = "connecting";
  realtimeSocket = createRealtimeClient({ getToken });

  realtimeSocket.on("connect", () => {
    connectionState.value = "connected";
  });
  realtimeSocket.on("disconnect", () => {
    connectionState.value = "disconnected";
  });
  realtimeSocket.on("fuel_price_changed", (event: FuelPriceChangedEvent) => {
    current.value = normalizeFuelEvent(event);
  });
}

export function stopFuelRealtime(): void {
  realtimeSocket?.disconnect();
  realtimeSocket = null;
  connectionState.value = "disconnected";
}

function normalizeFuelEvent(event: FuelPriceChangedEvent): FuelPriceSnapshot {
  const recordedAt = new Date(event.recorded_at);
  const recorded_at = Number.isNaN(recordedAt.getTime())
    ? new Date().toISOString()
    : recordedAt.toISOString();

  return {
    price: Number(event.price.toFixed(2)),
    recorded_at,
    source: "backend-realtime",
    unit_price: Number((event.price * 9.5).toFixed(2)),
    updated_at: new Date().toISOString(),
  };
}
