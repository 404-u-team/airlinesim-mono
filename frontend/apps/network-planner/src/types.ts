export type CreateRouteResponse = {
  route: StoredRoute;
};

export type RouteAircraftOption = {
  aircraft: {
    id?: string;
    tail_number?: string;
  };
  blockers: RouteReason[];
  isCompatible: boolean;
  type: null | {
    max_planned_seat_capacity?: number;
    model_name?: string;
  };
  warnings: RouteReason[];
};

export type RouteAirport = {
  iata_code?: string;
  icao_code?: string;
  id?: string;
  intl_name?: string;
  label: string;
  max_runway_length_m?: number;
  max_runway_uses_per_day?: number;
  municipality?: string;
  works_at_night?: boolean;
};

export type RouteDemandSnapshot = {
  destination_daily_passengers: number;
  distance_km: number;
  origin_daily_passengers: number;
};

export type RouteEconomics = {
  estimated_cost_per_flight: number;
  estimated_profit_per_flight: number;
  estimated_revenue_per_flight: number;
  expected_load_factor: number;
};

export type RouteOpportunitiesResponse = {
  opportunities: RouteOpportunity[];
  origin_airport: null | RouteAirport;
  routes: StoredRoute[];
};

export type RouteOpportunity = {
  compatible_aircraft: RouteAircraftOption[];
  constraints: RouteReason[];
  demand: RouteDemandSnapshot;
  destination_airport: RouteAirport;
  economics: RouteEconomics;
  existing_route_id?: string;
  origin_airport: RouteAirport;
  recommendation: "blocked" | "open" | "risky";
  score: number;
  warnings: RouteReason[];
};

export type RoutePreviewResponse = {
  preview: RouteOpportunity;
};

export type RouteReason = {
  code: string;
  message: string;
};

export type RoutesResponse = {
  routes: StoredRoute[];
};

export type StoredRoute = {
  base_frequency_per_week: number;
  demand_snapshot: RouteDemandSnapshot;
  destination_airport: null | RouteAirport;
  economics_snapshot: RouteEconomics;
  id: string;
  next_action: {
    code: string;
    target_path: string;
  };
  origin_airport: null | RouteAirport;
  selected_aircraft_id?: string;
  status: string;
};
