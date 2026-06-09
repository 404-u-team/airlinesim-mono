export type AirportSearchOption = {
  country_id?: string;
  country_name?: string;
  fuel_price_multiplier?: number;
  gate_fee?: number;
  iata_code?: string;
  icao_code?: string;
  id: string;
  intl_name?: string;
  local_name?: string;
  max_runway_length_m?: number;
  max_runway_uses_per_day?: number;
  municipality?: string;
  region_id?: string;
  runway_fee?: number;
  stand_fee?: number;
  works_at_night?: boolean;
};

export type CreateRouteResponse = {
  route: StoredRoute;
};

export type HubItem = {
  airport_id: string;
  created_at: string;
  fee: number;
  is_base: boolean;
  label: string;
  profit: number;
  routes: number;
};

export type HubPreviewAirport = {
  country_id?: string;
  fuel_price_multiplier?: number;
  gate_fee?: number;
  iata_code?: string;
  icao_code?: string;
  id: string;
  intl_name?: string;
  local_name?: string;
  max_runway_length_m?: number;
  max_runway_uses_per_day?: number;
  municipality?: string;
  region_id?: string;
  runway_fee?: number;
  stand_fee?: number;
  works_at_night?: boolean;
};

export type HubPreviewBalance = {
  available: number;
  can_afford: boolean;
  remaining: number;
};

export type HubPreviewFeeDetails = {
  airport_weight: number;
  base_fee: number;
  final_fee: number;
  max_fee_cap: number;
  min_fee_cap: number;
  raw_total: number;
  region_weight: number;
};

export type HubPreviewRegion = {
  business_score?: number;
  gdp_per_capita?: number;
  id: string;
  population?: number;
  tourism_score?: number;
};

export type HubPreviewResponse = {
  airport: HubPreviewAirport;
  balance: HubPreviewBalance;
  fee_details: HubPreviewFeeDetails;
  region: HubPreviewRegion | null;
};

export type RouteAircraftOption = {
  aircraft: {
    id?: string;
    tail_number?: string;
    type_id?: string;
  };
  blockers: RouteReason[];
  isCompatible: boolean;
  type: null | {
    icao_code?: string;
    image_url?: string;
    max_planned_seat_capacity?: number;
    model_name?: string;
  };
  warnings: RouteReason[];
};

export type RouteAirport = {
  coordinates?: null | {
    latitude: number;
    longitude: number;
  };
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

export type RouteDemandBreakdown = {
  affinityFactor: number;
  airportFactor: number;
  baseDemand: number;
  business: number;
  calibrationK: number;
  destinationGdpPerCapita: number;
  destinationPopulation: number;
  diaspora: number;
  directionFactorDestinationToOrigin: number;
  directionFactorOriginToDestination: number;
  distanceImpedance: number;
  domesticMultiplier: number;
  gdpElasticity: number;
  gravity: number;
  originGdpPerCapita: number;
  originPopulation: number;
  populationElasticity: number;
  sameCountry: boolean;
  shortHaulFactor: number;
  source: "model" | "region_link";
  tourism: number;
};

export type RouteDemandSnapshot = {
  breakdown?: RouteDemandBreakdown;
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
