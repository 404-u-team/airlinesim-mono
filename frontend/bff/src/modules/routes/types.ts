import type { Aircraft, AircraftType, Airport } from "../fleet/types";

export type RouteAircraftOption = {
  aircraft: Aircraft;
  blockers: RouteReason[];
  isCompatible: boolean;
  type: AircraftType | null;
  warnings: RouteReason[];
};

export type RouteAirport = Airport & {
  coordinates?: null | {
    latitude: number;
    longitude: number;
  };
  label: string;
};

export type RouteDemandSnapshot = {
  calculated_at: string;
  destination_daily_passengers: number;
  distance_km: number;
  origin_daily_passengers: number;
  region_link_id?: string;
};

export type RouteEconomics = {
  confidence: "high" | "low" | "medium";
  estimated_cost_per_flight: number;
  estimated_fare_per_passenger: number;
  estimated_profit_per_flight: number;
  estimated_revenue_per_flight: number;
  expected_load_factor: number;
};

export type RouteListItem = StoredRoute & {
  assigned_aircraft: null | RouteAircraftOption;
  destination_airport: null | RouteAirport;
  next_action: {
    code: "CREATE_SCHEDULE" | "VIEW_FLIGHTS" | "VIEW_ROUTE";
    target_path: string;
  };
  origin_airport: null | RouteAirport;
};

export type RouteOpportunity = {
  compatible_aircraft: RouteAircraftOption[];
  constraints: RouteReason[];
  demand: RouteDemandSnapshot;
  destination_airport: RouteAirport;
  economics: RouteEconomics;
  existing_route_id?: string;
  origin_airport: RouteAirport;
  recommendation: RouteRecommendation;
  score: number;
  warnings: RouteReason[];
};

export type RouteReason = {
  code: RouteReasonCode;
  message: string;
};

export type RouteReasonCode =
  | "AIRCRAFT_MAINTENANCE_LOW"
  | "AIRCRAFT_NOT_READY"
  | "AIRCRAFT_RANGE_TOO_SHORT"
  | "AIRCRAFT_REPOSITION_REQUIRED"
  | "AIRPORT_DATA_INCOMPLETE"
  | "AIRPORT_NIGHT_OPS_PROHIBITED"
  | "AIRPORT_RUNWAY_TOO_SHORT"
  | "AIRPORT_SLOT_CAPACITY_EXCEEDED"
  | "AIRPORT_SLOT_CAPACITY_LOW"
  | "AIRPORT_TIMEZONE_MISSING"
  | "DESTINATION_RUNWAY_TOO_SHORT"
  | "DISTANCE_EXCEEDS_RANGE"
  | "DUPLICATE_ROUTE"
  | "LOW_DEMAND"
  | "LOW_PROFIT"
  | "MISSING_AIRCRAFT_TYPE"
  | "MISSING_AIRPORT"
  | "MISSING_AIRPORT_COORDINATES"
  | "NO_COMPATIBLE_AIRCRAFT"
  | "NO_DEMAND_DATA"
  | "ORIGIN_NOT_BASE"
  | "ORIGIN_RUNWAY_TOO_SHORT";

export type RouteRecommendation = "blocked" | "open" | "risky";

export type RouteStatus = "active" | "awaiting_schedule" | "draft" | "paused" | "scheduled";

export type StoredRoute = {
  airline_id: string;
  base_frequency_per_week: number;
  constraints_snapshot: RouteReason[];
  created_at: string;
  demand_snapshot: RouteDemandSnapshot;
  destination_airport_id: string;
  economics_snapshot: RouteEconomics;
  id: string;
  origin_airport_id: string;
  selected_aircraft_id?: string;
  selected_aircraft_type_id?: string;
  status: RouteStatus;
  updated_at: string;
  warnings_snapshot: RouteReason[];
};
