export type FuelPriceSnapshot = {
  price: number;
  recorded_at: string;
  source: "backend-realtime" | "fallback" | "storage";
  unit_price: number;
  updated_at: string;
};
