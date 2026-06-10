export type DashboardAirport = {
  coordinates?: null | {
    latitude: number;
    longitude: number;
  };
  gate_fee?: number;
  iata_code?: string;
  icao_code?: string;
  id?: string;
  intl_name?: string;
  label: string;
  local_name?: string;
  max_runway_length_m?: number;
  max_runway_uses_per_day?: number;
  municipality?: string;
  runway_fee?: number;
  stand_fee?: number;
  turnaround_point_price?: number;
  works_at_night?: boolean;
};

export type DashboardAlert = {
  action_code: string;
  code: string;
  id: string;
  severity: "danger" | "info" | "success" | "warning";
  target_path: string;
};

export type DashboardFlightDetail = {
  aircraft: null | { id: string; model_name?: string; seats?: number; tail_number?: string };
  flight: FlightDetailCard;
  route_id: string;
};

export type DashboardMapState = {
  airports: {
    features: MapAirportFeature[];
    type: "FeatureCollection";
  };
  capabilities: {
    flights: "available" | "not_configured";
    routes: "available" | "not_configured";
  };
  flights?: {
    features: unknown[];
    type: "FeatureCollection";
  };
  routes: {
    features: unknown[];
    type: "FeatureCollection";
  };
  scope: string;
  selected: null | {
    airport: DashboardAirport;
    cta_target_path: string;
    demand: number;
    region_name: string;
    score: number;
  };
  viewport?: Record<string, unknown>;
  warnings: string[];
};

export type DashboardNextActionCode =
  | "BUY_FIRST_AIRCRAFT"
  | "CREATE_SCHEDULE"
  | "PLAN_FIRST_ROUTE"
  | "VIEW_OPERATIONS";

export type DashboardProgressItem = {
  count: number;
  next_path: string;
  path: string;
  reason_code: string;
  state: "blocked" | "empty" | "future" | "ready";
};

export type DashboardSummary = {
  airline: {
    balance: number;
    credit_rating: number;
    id?: string;
    is_bankrupt: boolean;
    name: string;
    reputation: number;
    safety_rating: number;
  };
  alerts: DashboardAlert[];
  base: {
    airport: DashboardAirport | null;
    status: "missing" | "ready";
    warnings: string[];
  };
  fleet: {
    average_maintenance_ratio: number;
    compatible_base_types: number;
    fleet_value: number;
    in_flight_aircraft: number;
    maintenance_aircraft: number;
    ready_aircraft: number;
    total_aircraft: number;
  };
  flights: {
    capabilities: "available" | "not_configured";
    completed_today: number;
    items: unknown[];
    live_flights: number;
    upcoming_flights: number;
  };
  navigation_progress: DashboardProgressItem[];
  next_action: {
    code: DashboardNextActionCode;
    secondary_target_path?: string;
    target_path: string;
  };
  routes: {
    active_routes: number;
    awaiting_schedule: number;
    capabilities: "available" | "not_configured";
    draft_routes: number;
    items: unknown[];
  };
  updated_at: string;
};

export type FlightDetailCard = {
  actual?: FlightFinancials;
  aircraft_id: string;
  arrival_at: string;
  departure_at: string;
  destination_airport: FlightAirportRef;
  destination_airport_id: string;
  destination_coordinates: FlightCoordinates | null;
  expected: FlightFinancials;
  flight_number: string;
  id: string;
  origin_airport: FlightAirportRef;
  origin_airport_id: string;
  origin_coordinates: FlightCoordinates | null;
  status: "boarding" | "cancelled" | "completed" | "in_flight" | "scheduled";
  telemetry: FlightTelemetry;
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

export type MapAirportFeature = {
  geometry: {
    coordinates: [number, number];
    type: "Point";
  };
  id?: string;
  properties: {
    demand?: number;
    iata_code?: string;
    icao_code?: string;
    id?: string;
    label: string;
    role: "base" | "opportunity";
    score?: number;
  };
  type: "Feature";
};

export type ShellStatusSummary = {
  aircraft: number;
  alerts: number;
  balance: number;
};

type FlightAirportRef = { iata_code?: string; label: string };

type FlightCoordinates = { latitude: number; longitude: number };

type FlightFinancials = {
  cost: number;
  load_factor: number;
  passengers: number;
  profit: number;
  revenue: number;
};
