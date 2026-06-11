import type { FuelPriceSnapshot, FuelStorageSnapshot } from "./types";

import { apiClient } from "../api";

export async function getFuelPrice(): Promise<FuelPriceSnapshot> {
  return apiClient.get<FuelPriceSnapshot>("/fuel/price");
}

export async function getFuelStorage(): Promise<{ storage: FuelStorageSnapshot }> {
  return apiClient.get<{ storage: FuelStorageSnapshot }>("/fuel/storage");
}
