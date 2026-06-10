export type EventCategory = "finance" | "fleet" | "operations" | "route" | "system";
export type EventCode =
  | "AIRCRAFT_PURCHASED"
  | "FINANCE_RESULT_RECORDED"
  | "FLIGHT_COMPLETED"
  | "HUB_ESTABLISHED"
  | "ROUTE_CREATED"
  | "ROUTE_PRICE_ANALYSIS"
  | "SCHEDULE_ACTIVATED"
  | "WARNING_CREATED"
  | "WARNING_RESOLVED";
export type EventInput = Omit<StoredGameEvent, "created_at" | "id">;
export type NotificationCode =
  | "BANKRUPTCY_FLAG"
  | "BASE_AIRCRAFT_INCOMPATIBLE"
  | "BASE_NIGHT_OPS_CONFLICT"
  | "BASE_SLOT_CAPACITY_EXCEEDED"
  | "BASE_SLOT_CAPACITY_LOW"
  | "LOW_BALANCE"
  | "LOW_MAINTENANCE"
  | "ROUTE_LOSS"
  | "ROUTES_AWAITING_SCHEDULE"
  | "SCHEDULE_BLOCKED"
  | "WEEKLY_OPERATING_LOSS";

export type NotificationRisk = {
  airline_id: string;
  code: NotificationCode;
  dedupe_key: string;
  parameters: Record<string, boolean | number | string>;
  related: StoredNotification["related"];
  severity: Severity;
  target_path: string;
};

export type Severity = "danger" | "info" | "success" | "warning";

export type StoredGameEvent = {
  airline_id: string;
  category: EventCategory;
  code: EventCode;
  created_at: string;
  dedupe_key: string;
  id: string;
  occurred_at: string;
  parameters: Record<string, boolean | number | string>;
  related: {
    aircraft_id?: string;
    flight_id?: string;
    route_id?: string;
    schedule_id?: string;
  };
  severity: Severity;
  source_id: string;
  source_type: "aircraft" | "flight" | "route" | "schedule" | "system";
  target_path: string;
};

export type StoredNotification = {
  airline_id: string;
  code: NotificationCode;
  dedupe_key: string;
  first_seen_at: string;
  id: string;
  is_read: boolean;
  last_seen_at: string;
  parameters: Record<string, boolean | number | string>;
  related: {
    aircraft_id?: string;
    route_id?: string;
    schedule_id?: string;
  };
  resolved_at?: string;
  severity: Severity;
  state: "active" | "ignored" | "resolved";
  target_path: string;
};
