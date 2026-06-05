export type CreateScheduleResponse = SchedulePreviewResponse & {
  flights: FlightCard[];
  schedule: {
    id: string;
    route_id: string;
    status: string;
  };
};

export type FleetAircraftDetailResponse = {
  aircraft: FleetOwnedAircraftCard;
};

export type FleetAircraftResponse = {
  aircraft: FleetOwnedAircraftCard[];
  emptyState: null | {
    code: "NO_AIRCRAFT";
    recommendedActionRoute: string;
  };
};

export type FleetAirportCard = {
  id?: string;
  label: string;
  max_runway_length_m: number;
  max_runway_uses_per_day: number;
  works_at_night: boolean;
};

export type FleetMarketAircraftType = {
  base_maintenance_points?: number;
  base_turnaround_points?: number;
  compatibility: {
    canAfford: boolean;
    canPurchase: boolean;
    canUseBase: boolean;
    score: number;
    status: "available" | "blocked" | "recommended" | "risky";
    warnings: FleetReason[];
  };
  cruising_speed_kph?: number;
  fuel_consumption_per_hour?: number;
  iata_code?: string;
  icao_code?: string;
  id?: string;
  image_url?: string;
  maint_cost_per_flight_hour?: number;
  max_planned_seat_capacity?: number;
  max_range_km?: number;
  min_runway_length_m?: number;
  model_name?: string;
  preview: {
    cashReserveWarning: boolean;
    estimatedDailyMaintenanceReserve: number;
    recommendedReserve: number;
    remainingBalance: number;
  };
  price_per_unit?: number;
};

export type FleetMarketResponse = {
  aircraftTypes: FleetMarketAircraftType[];
  airline: {
    balance: number;
    id?: string;
    name?: string;
    starting_airport_id?: string;
  };
  baseAirport: FleetAirportCard | null;
  ownedAircraft: FleetOwnedAircraftCard[];
  summary: {
    affordableTypes: number;
    baseCompatibleTypes: number;
    recommendedTypeId?: string;
    totalTypes: number;
    visibleTypes: number;
  };
};

export type FleetOwnedAircraftCard = {
  assignment: {
    label: string;
    status: "unassigned";
  };
  base_airport_id?: string;
  baseAirport: FleetAirportCard | null;
  baseAirportName: string;
  current_maintenance_points?: number;
  id?: string;
  in_service?: boolean;
  maintenanceRatio: number;
  manufactured_at?: string;
  max_maintenance_points_cached?: number;
  modelName: string;
  recommendedAction: {
    labelKey: string;
    route: string;
  };
  status?: string;
  tail_number?: string;
  total_cycles?: number;
  total_flight_hours?: number;
  type?: FleetMarketAircraftType | null;
  type_id?: string;
};

export type FleetPurchasePreviewResponse = {
  aircraftPrice: number;
  aircraftType: FleetMarketAircraftType | null;
  airlineBalance: number;
  baseAirport: FleetAirportCard | null;
  blockingReasons: FleetReason[];
  canPurchase: boolean;
  estimatedDailyMaintenanceReserve: number;
  recommendedReserve: number;
  remainingBalance: number;
  tailNumber: {
    conflict: boolean;
    message?: string;
    normalizedValue: string;
    suggestedPrefix?: string;
    valid: boolean;
  };
  warnings: FleetReason[];
};

export type FleetPurchaseResponse = {
  aircraft: FleetOwnedAircraftCard | null;
  finance: {
    aircraftPrice: number;
    currentBalance?: number;
    previousBalance?: number;
  };
  recommendedNextAction: {
    labelKey: string;
    route: string;
  };
};

export type FleetReason = {
  code: FleetReasonCode;
  message: string;
};

export type FleetReasonCode =
  | "FLEET_AIRCRAFT_TYPE_NOT_FOUND"
  | "FLEET_BASE_AIRPORT_NOT_FOUND"
  | "FLEET_INSUFFICIENT_FUNDS"
  | "FLEET_LARGE_AIRCRAFT_FIRST_PURCHASE"
  | "FLEET_LOW_SLOT_CAPACITY"
  | "FLEET_MISSING_PRICE"
  | "FLEET_MISSING_RUNWAY_DATA"
  | "FLEET_NO_NIGHT_OPS"
  | "FLEET_RESERVE_RISK"
  | "FLEET_RUNWAY_TOO_SHORT"
  | "FLEET_TAIL_NUMBER_EXISTS"
  | "FLEET_TAIL_NUMBER_INVALID";

export type FlightCard = {
  aircraft_id: string;
  arrival_at: string;
  departure_at: string;
  destination_airport_id: string;
  expected: FlightFinancials;
  flight_number: string;
  id: string;
  origin_airport_id: string;
  route_id: string;
  status: "boarding" | "cancelled" | "completed" | "in_flight" | "scheduled";
};

export type FlightFinancials = {
  cost: number;
  load_factor: number;
  passengers: number;
  profit: number;
  revenue: number;
};

export type FlightsResponse = {
  flights: FlightCard[];
  summary: {
    completed: number;
    live: number;
    upcoming: number;
  };
};

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

export type OperationAircraftOption = {
  aircraft: FleetOwnedAircraftCard;
  blockers: OperationReason[];
  compatible: boolean;
  warnings: OperationReason[];
};

export type OperationReason = {
  code: string;
  message: string;
};

export type OperationRoute = {
  demand_snapshot: {
    distance_km: number;
    origin_daily_passengers: number;
  };
  destination_airport: null | {
    label: string;
  };
  destination_airport_id: string;
  id: string;
  origin_airport: null | {
    label: string;
  };
  origin_airport_id: string;
  status: string;
};

export type ScheduleOptionsResponse = {
  aircraft: OperationAircraftOption[];
  default_pattern: {
    days_of_week: number[];
    departure_local_time: string;
    turnaround_minutes: number;
  };
  route: null | OperationRoute;
  routes: OperationRoute[];
};

export type SchedulePreviewResponse = {
  preview: {
    blockers: OperationReason[];
    canActivate: boolean;
    economics: {
      weekly_cost: number;
      weekly_profit: number;
      weekly_revenue: number;
    };
    sample_flights: FlightCard[];
    warnings: OperationReason[];
    weekly_utilization_hours: number;
  };
};
