import type { AirlinepbAirlineResponse } from "@airlinesim/api-contracts";

import { apiClient } from "../api";

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

export type OnboardingSession = {
  airline?: AirlinepbAirlineResponse | null;
  airlineExists: boolean;
  authenticated: boolean;
  onboardingStep: "AIRLINE_REQUIRED" | "AUTH_REQUIRED" | "READY";
  recommendedNextRoute: string;
  startingAirport?: null | OnboardingAirportOption;
};

export async function createOnboardingAirline(payload: {
  iata_code: string;
  icao_code: string;
  name: string;
  starting_airport_id: string;
}): Promise<{ airline: AirlinepbAirlineResponse; recommendedNextRoute: string; startingAirport: OnboardingAirportOption }> {
  return apiClient.post<{ airline: AirlinepbAirlineResponse; recommendedNextRoute: string; startingAirport: OnboardingAirportOption }>(
    "/onboarding/airline",
    payload,
  );
}

export async function getOnboardingSession(): Promise<OnboardingSession> {
  return apiClient.get<OnboardingSession>("/onboarding/session");
}

export async function searchStartingAirports(
  query: string,
  filters: { country_id?: string; region_id?: string } = {},
): Promise<OnboardingAirportOption[]> {
  const params = new URLSearchParams({ q: query });
  if (filters.country_id) {
    params.append("country_id", filters.country_id);
  }
  if (filters.region_id) {
    params.append("region_id", filters.region_id);
  }

  const res = await apiClient.get<{ airports: OnboardingAirportOption[] }>(
    `/onboarding/airports?${params.toString()}`,
  );

  return res.airports;
}
