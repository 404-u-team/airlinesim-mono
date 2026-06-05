import type { FuelPriceSnapshot } from "./types";

import { apiClient } from "../api";

export async function getFuelPrice(): Promise<FuelPriceSnapshot> {
  return apiClient.get<FuelPriceSnapshot>("/fuel/price");
}
