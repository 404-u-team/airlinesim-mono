export type Airport = {
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
  turnaround_point_price?: number;
  works_at_night?: boolean;
};

export type BackendAirline = {
  iata_code: string;
  icao_code: string;
  id: string;
  name: string;
  starting_airport_id?: string;
};

export type CreateAirlineRequest = {
  iata_code?: string;
  icao_code?: string;
  name?: string;
  starting_airport_id?: string;
};

export type OnboardingAirportOption = {
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
  score: number;
  stand_fee?: number;
  warnings: string[];
  works_at_night?: boolean;
};
