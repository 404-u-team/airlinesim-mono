export type * from "./fuel-types";

export type AirportSearchOption = { iata_code?: string; icao_code?: string; id: string; intl_name?: string; local_name?: string; municipality?: string; };
export type AirportSearchResponse = { airports: AirportSearchOption[]; };
export type CreateRouteResponse = { route: OperationRoute; };
export type CreateScheduleResponse = SchedulePreviewResponse & {
  flights: FlightCard[];
  schedule: { id: string; route_id: string; status: string; };
};
export type FleetAircraftDetailResponse = { aircraft: FleetOwnedAircraftCard; };
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
  timezone?: string;
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
  currentLocation?: {
    airport?: {
      id: string;
      label: string;
    };
    flight?: FlightDetail;
    type: "airport" | "flight";
  };
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
export type FlightAirportRef = {
  iata_code?: string;
  label?: string;
};

export type FlightCard = {
  aircraft_id: string;
  arrival_at: string;
  departure_at: string;
  destination_airport?: FlightAirportRef;
  destination_airport_id: string;
  expected: FlightFinancials;
  flight_number: string;
  id: string;
  origin_airport?: FlightAirportRef;
  origin_airport_id: string;
  out_of_position?: boolean;
  route_id: string;
  status: "boarding" | "cancelled" | "completed" | "in_flight" | "scheduled";
};

export type FlightDetail = FlightCard & {
  actual?: FlightFinancials;
  destination_coordinates: null | { latitude: number; longitude: number };
  origin_coordinates: null | { latitude: number; longitude: number };
  telemetry: FlightTelemetry;
};

export type FlightDetailResponse = {
  aircraft: null | { id: string; model_name?: string; seats?: number; tail_number?: string };
  flight: FlightDetail;
  route_id: string;
};
export type FlightFinancials = {
  cost: number;
  load_factor: number;
  passengers: number;
  profit: number;
  revenue: number;
};
export type FlightPhase =
  | "arrived"
  | "boarding"
  | "climb"
  | "cruise"
  | "deplaning"
  | "descent"
  | "landing"
  | "scheduled"
  | "takeoff"
  | "taxi_in"
  | "taxi_out";
export type FlightsResponse = {
  flights: FlightCard[];
  summary: {
    completed: number;
    live: number;
    upcoming: number;
  };
};
export type FlightTelemetry = {
  air_progress: number;
  altitude_ft: number;
  cruise_flight_level: number;
  eta_minutes: number;
  fuel_remaining_t: number;
  ground_speed_kph: number;
  passengers_on_board: number;
  phase: FlightPhase;
  progress: number;
};
export type HubOption = {
  airport_id: string;
  fee: number;
  is_base: boolean;
  label: string;
  profit: number;
  routes: number;
};
export type HubsResponse = {
  hubs: HubOption[];
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
    iata_code?: string;
    label: string;
  };
  destination_airport_id: string;
  economics_snapshot?: {
    estimated_profit_per_flight: number;
  };
  id: string;
  origin_airport: null | {
    iata_code?: string;
    label: string;
  };
  origin_airport_id: string;
  status: string;
};
export type OperationSchedule = {
  aircraft_id: string;
  id: string;
  pattern: {
    days_of_week: number[];
    departure_local_time: string;
    round_trip: boolean;
    turnaround_minutes: number;
  };
  route_id: string;
  status: "active" | "draft" | "paused";
};
export type ReplaceScheduleResponse = {
  flights: FlightCard[];
  previews: Array<SchedulePreviewResponse["preview"]>;
  schedules: OperationSchedule[];
};
export type RouteAirportRef = {
  coordinates?: null | { latitude: number; longitude: number };
  gate_fee?: number;
  iata_code?: string;
  icao_code?: string;
  id?: string;
  label: string;
  max_runway_length_m?: number;
  municipality?: string;
  runway_fee?: number;
  stand_fee?: number;
  works_at_night?: boolean;
};
export type RouteOpportunitiesResponse = {
  opportunities: RouteOpportunityItem[];
  origin_airport: null | RouteAirportRef;
};
export type RouteOpportunityItem = {
  demand: { destination_daily_passengers: number; distance_km: number; origin_daily_passengers: number };
  destination_airport: RouteAirportRef;
  economics: { estimated_profit_per_flight: number };
  existing_route_id?: string;
  origin_airport: RouteAirportRef;
  recommendation: "blocked" | "open" | "risky";
};
export type ScheduleOptionsResponse = {
  aircraft: OperationAircraftOption[];
  default_pattern: {
    days_of_week: number[];
    departure_local_time: string;
    round_trip?: boolean;
    turnaround_minutes: number;
  };
  route: null | OperationRoute;
  routes: OperationRoute[];
  schedules: OperationSchedule[];
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
