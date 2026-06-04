export type FinanceRisk = {
  code: "BANKRUPTCY_FLAG" | "LOW_BALANCE" | "ROUTE_LOSS" | "WEEKLY_OPERATING_LOSS";
  severity: "danger" | "warning";
  target_path: string;
  value?: number;
};

export type LedgerCategory = "airport" | "fuel" | "maintenance" | "operations" | "revenue" | "system";

export type LedgerTransaction = {
  airline_id: string;
  amount: number;
  category: LedgerCategory;
  created_at: string;
  currency: "USD";
  direction: "credit" | "debit";
  flight_id?: string;
  id: string;
  idempotency_key: string;
  label_code: string;
  occurred_at: string;
  route_id?: string;
  schedule_id?: string;
  source_id?: string;
  source_type: "airport_fee" | "flight_revenue" | "fuel_cost" | "maintenance_reserve" | "system_adjustment";
};
