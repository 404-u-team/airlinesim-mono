export type FinanceOverview = {
  airline: {
    is_bankrupt?: boolean;
    name?: string;
  };
  balance: {
    available: number;
    backend_baseline: number;
    operations_delta: number;
  };
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

export type LedgerTransaction = {
  amount: number;
  category: string;
  direction: "credit" | "debit";
  flight_id?: string;
  id: string;
  label_code: string;
  occurred_at: string;
  route_id?: string;
};

export type RouteProfitability = FinanceSummary & {
  destination_airport_id: string;
  flights_completed: number;
  origin_airport_id: string;
  recommendation: "healthy" | "insufficient_data" | "review";
  route_id: string;
};
