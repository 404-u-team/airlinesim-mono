export type FlightFinancials = {
  cost: number;
  // Jet fuel the flight burns, in tonnes. Drawn from the airline's fuel storage at
  // settlement (spot-purchased only for the shortfall). Optional: legacy rows miss it.
  fuel_tonnes?: number;
  load_factor: number;
  passengers: number;
  profit: number;
  revenue: number;
};

export type FlightStatus = "boarding" | "cancelled" | "completed" | "in_flight" | "scheduled";

export type OperationReason = {
  code: OperationReasonCode;
  message: string;
  parameters?: Record<string, boolean | number | string>;
  target_path?: string;
};

export type OperationReasonCode =
  | "AIRCRAFT_CONFLICT"
  | "AIRCRAFT_MAINTENANCE_LOW"
  | "AIRCRAFT_NOT_FOUND"
  | "AIRCRAFT_NOT_READY"
  | "AIRCRAFT_OUT_OF_POSITION"
  | "AIRCRAFT_RANGE_TOO_SHORT"
  | "AIRPORT_DATA_INCOMPLETE"
  | "AIRPORT_NIGHT_OPS_LIMITED"
  | "AIRPORT_NIGHT_OPS_PROHIBITED"
  | "AIRPORT_RUNWAY_TOO_SHORT"
  | "AIRPORT_SLOT_CAPACITY_EXCEEDED"
  | "AIRPORT_SLOT_CAPACITY_LOW"
  | "AIRPORT_TIMEZONE_MISSING"
  | "CASH_RESERVE_LOW"
  | "DESTINATION_RUNWAY_TOO_SHORT"
  | "NO_DAYS_SELECTED"
  | "ONE_WAY_REQUIRES_HUBS"
  | "ORIGIN_RUNWAY_TOO_SHORT"
  | "OVERSUPPLY_RISK"
  | "ROUTE_NOT_FOUND"
  | "ROUTE_NOT_READY";

export type SchedulePattern = {
  days_of_week: number[];
  departure_local_time: string;
  mode: "daily" | "weekly";
  round_trip: boolean;
  timezone?: string;
  turnaround_minutes: number;
};

export type SchedulePreview = {
  blockers: OperationReason[];
  canActivate: boolean;
  economics: {
    weekly_cost: number;
    weekly_profit: number;
    weekly_revenue: number;
  };
  sample_flights: StoredFlight[];
  warnings: OperationReason[];
  weekly_utilization_hours: number;
};

export type StoredFlight = {
  actual?: FlightFinancials;
  aircraft_id: string;
  airline_id: string;
  arrival_at: string;
  created_at: string;
  departure_at: string;
  destination_airport_id: string;
  expected: FlightFinancials;
  flight_number: string;
  id: string;
  origin_airport_id: string;
  // Derived on read: the aircraft is not at this flight's origin when it is due to
  // depart (e.g. a ferry leg moved it elsewhere). Not persisted.
  out_of_position?: boolean;
  route_id: string;
  schedule_id: string;
  status: FlightStatus;
  updated_at: string;
};

export type StoredSchedule = {
  aircraft_id: string;
  airline_id: string;
  checks_snapshot: OperationReason[];
  created_at: string;
  id: string;
  pattern: SchedulePattern;
  route_id: string;
  status: "active" | "draft" | "paused";
  updated_at: string;
  validity: {
    ends_on?: string;
    starts_on: string;
  };
};
