export type FuelHistoryResponse = {
  history: FuelPriceSnapshot[];
};
export type FuelPriceSnapshot = {
  price: number;
  recorded_at: string;
  source: "backend-realtime" | "fallback" | "storage";
  unit_price: number;
  updated_at: string;
};
export type FuelPurchaseResult = {
  cost: number;
  price_per_tonne: number;
  storage: FuelStorageSnapshot;
};
export type FuelStorageHistoryEntry = {
  change_tonnes: number;
  price_per_tonne?: number;
  reason: "consumption" | "purchase";
  recorded_at: string;
  stored_tonnes: number;
};
export type FuelStorageResponse = {
  storage: FuelStorageSnapshot;
};
export type FuelStorageSnapshot = {
  average_purchase_price: null | number;
  capacity_tonnes: number;
  current_price_per_tonne: number;
  history: FuelStorageHistoryEntry[];
  stored_tonnes: number;
  updated_at: string;
};
