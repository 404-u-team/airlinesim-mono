export type FinanceRisk = {
  code: "BANKRUPTCY_FLAG" | "LOW_BALANCE" | "ROUTE_LOSS" | "WEEKLY_OPERATING_LOSS";
  severity: "danger" | "warning";
  target_path: string;
  value?: number;
};

export type LedgerCategory = "airport" | "capital" | "fuel" | "maintenance" | "operations" | "revenue" | "system";

export type LedgerTransaction = {
  airline_id: string;
  amount: number;
  category: LedgerCategory;
  created_at: string;
  currency: "USD";
  direction: "credit" | "debit";
  // True for records that mirror a charge the backend already took from the balance
  // (e.g. aircraft purchase). They show up in transaction lists but must not shift
  // the BFF-side balance delta, or the charge would be counted twice.
  excluded_from_balance?: boolean;
  flight_id?: string;
  id: string;
  idempotency_key: string;
  label_code: string;
  occurred_at: string;
  parameters?: Record<string, boolean | number | string>;
  route_id?: string;
  schedule_id?: string;
  source_id?: string;
  source_type: "aircraft_purchase" | "airport_fee" | "flight_revenue" | "fuel_cost" | "fuel_purchase" | "maintenance_reserve" | "system_adjustment";
};
