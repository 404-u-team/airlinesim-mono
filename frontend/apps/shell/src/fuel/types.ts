export type FuelPriceSnapshot = {
  price: number;
  recorded_at: string;
  source: "backend-realtime" | "fallback" | "storage";
  unit_price: number;
  updated_at: string;
};

export type FuelStorageSnapshot = {
  average_purchase_price: null | number;
  capacity_tonnes: number;
  current_price_per_tonne: number;
  stored_tonnes: number;
  updated_at: string;
};
