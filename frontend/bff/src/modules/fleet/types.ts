export type Aircraft = {
  base_airport_id?: string;
  current_maintenance_points?: number;
  current_owner_id?: string;
  fh_since_last_d_check?: number;
  id?: string;
  in_service?: boolean;
  manufactured_at?: string;
  max_maintenance_points_cached?: number;
  status?: string;
  tail_number?: string;
  total_cycles?: number;
  total_flight_hours?: number;
  type_id?: string;
};

export type AircraftType = {
  base_maintenance_points?: number;
  base_turnaround_points?: number;
  characteristics?: string;
  cruising_speed_kph?: number;
  fuel_consumption_per_hour?: number;
  iata_code?: string;
  icao_code?: string;
  id?: string;
  maint_cost_per_flight_hour?: number;
  max_planned_seat_capacity?: number;
  max_range_km?: number;
  min_runway_length_m?: number;
  model_name?: string;
  price_per_unit?: number;
};

export type Airline = {
  balance?: number;
  id?: string;
  name?: string;
  starting_airport_id?: string;
};

export type Airport = {
  country_id?: string;
  fuel_price_multiplier?: number;
  gate_fee?: number;
  geog?: string;
  geom?: string;
  iata_code?: string;
  icao_code?: string;
  id?: string;
  intl_name?: string;
  local_name?: string;
  maintenance_point_price?: number;
  max_runway_length_m?: number;
  max_runway_uses_per_day?: number;
  municipality?: string;
  region_id?: string;
  runway_fee?: number;
  stand_fee?: number;
  turnaround_point_price?: number;
  works_at_night?: boolean;
};

export type Country = {
  aircraft_tail_code?: string;
  id?: string;
  intl_name?: string;
  iso?: string;
};

export type FleetAirportCard = {
  gate_fee: number;
  iata_code?: string;
  icao_code?: string;
  id?: string;
  label: string;
  maintenance_point_price: number;
  max_runway_length_m: number;
  max_runway_uses_per_day: number;
  municipality?: string;
  runway_fee: number;
  stand_fee: number;
  turnaround_point_price: number;
  works_at_night: boolean;
};

export type FleetCompatibilityStatus = "available" | "blocked" | "recommended" | "risky";

export type FleetMarketAircraftType = AircraftType & {
  compatibility: {
    canAfford: boolean;
    canPurchase: boolean;
    canUseBase: boolean;
    score: number;
    status: FleetCompatibilityStatus;
    warnings: FleetReason[];
  };
  preview: {
    cashReserveWarning: boolean;
    estimatedDailyMaintenanceReserve: number;
    recommendedReserve: number;
    remainingBalance: number;
  };
};

export type FleetOwnedAircraftCard = Aircraft & {
  assignment: {
    label: string;
    status: "unassigned";
  };
  baseAirport: FleetAirportCard | null;
  baseAirportName: string;
  maintenanceRatio: number;
  modelName: string;
  recommendedAction: {
    labelKey: string;
    route: string;
  };
  type: AircraftType | null;
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

export type FleetSnapshot = {
  aircrafts: Aircraft[];
  aircraftTypes: AircraftType[];
  airline: Airline;
  airports: Airport[];
  countries: Country[];
};

export type PurchasePayload = {
  aircraft_type_id?: string;
  base_airport_id?: string;
  tail_number?: string;
};
