import { createApiClient } from "@airlinesim/game-sdk";

import type { FuelPriceSnapshot } from "../../fuel/types";

import { authState } from "../../auth";

const apiClient = createApiClient({
  getToken: () => authState.accessToken.value,
});

export async function getFuelHistory(): Promise<{ history: FuelPriceSnapshot[] }> {
  return apiClient.get<{ history: FuelPriceSnapshot[] }>("/fuel/history");
}

export async function getFuelPrice(): Promise<FuelPriceSnapshot> {
  return apiClient.get<FuelPriceSnapshot>("/fuel/price");
}
