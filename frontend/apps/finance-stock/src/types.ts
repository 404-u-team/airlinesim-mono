export type AircraftProfitability = FinanceSummary & {
  aircraft_id: string;
  aircraft_label: string;
  flights_completed: number;
};

export type FinanceOverview = {
  aircraft_profitability: AircraftProfitability[];
  airline: {
    is_bankrupt?: boolean;
    name?: string;
  };
  balance: {
    available: number;
    backend_baseline: number;
    operations_delta: number;
  };
  hub_profitability: HubProfitability[];
  metrics: {
    completed_flights: number;
    fleet_value: number;
    today: FinanceSummary;
    weekly: FinanceSummary;
  };
  recent_transactions: LedgerTransaction[];
  risks: Array<{
    code: "BANKRUPTCY_FLAG" | "LOW_BALANCE" | "ROUTE_LOSS" | "WEEKLY_OPERATING_LOSS";
    severity: "danger" | "warning";
    target_path: string;
    value?: number;
  }>;
  route_profitability: RouteProfitability[];
};

export type FinanceSummary = {
  costs: number;
  profit: number;
  revenue: number;
};

export type HubProfitability = FinanceSummary & {
  airport_id: string;
  flights_completed: number;
  is_base: boolean;
  label: string;
  routes: number;
};

export type LedgerPage = {
  summary: FinanceSummary;
  total: number;
  transactions: LedgerTransaction[];
};

export type LedgerTransaction = {
  amount: number;
  category: string;
  direction: "credit" | "debit";
  excluded_from_balance?: boolean;
  flight_id?: string;
  id: string;
  label_code: string;
  occurred_at: string;
  parameters?: Record<string, boolean | number | string>;
  route_id?: string;
};

export type RouteProfitability = FinanceSummary & {
  destination_airport_id: string;
  destination_airport_label?: string;
  flights_completed: number;
  origin_airport_id: string;
  origin_airport_label?: string;
  recommendation: "healthy" | "insufficient_data" | "review";
  route_id: string;
};
