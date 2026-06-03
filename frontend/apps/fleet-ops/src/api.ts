import { createApiClient, createAuthClient } from "@airlinesim/game-sdk";

import type {
  CreateScheduleResponse,
  FleetAircraftDetailResponse,
  FleetAircraftResponse,
  FleetMarketResponse,
  FleetPurchasePreviewResponse,
  FleetPurchaseResponse,
  FlightsResponse,
  ScheduleOptionsResponse,
  SchedulePreviewResponse,
} from "./types";

const authClient = createAuthClient();
const apiClient = createApiClient({
  getToken: authClient.getAccessToken,
});

export type FleetMarketFilters = {
  baseAirportId?: string;
  maxPrice?: string;
  minCapacity?: string;
  minRange?: string;
  q?: string;
  sort?: string;
};

export async function completeFlight(id: string): Promise<{ flight: unknown }> {
  return apiClient.post<{ flight: unknown }>(`/operations/flights/${encodeURIComponent(id)}/complete`, {});
}

export async function createSchedule(payload: {
  aircraft_id: string;
  days_of_week: number[];
  departure_local_time: string;
  route_id: string;
  turnaround_minutes: number;
}): Promise<CreateScheduleResponse> {
  return apiClient.post<CreateScheduleResponse>("/operations/schedules", payload);
}

export async function getFleetAircraft(): Promise<FleetAircraftResponse> {
  return apiClient.get<FleetAircraftResponse>("/fleet/aircraft");
}

export async function getFleetAircraftDetail(id: string): Promise<FleetAircraftDetailResponse> {
  return apiClient.get<FleetAircraftDetailResponse>(`/fleet/aircraft/${encodeURIComponent(id)}`);
}

export async function getFleetMarket(filters: FleetMarketFilters): Promise<FleetMarketResponse> {
  const search = new URLSearchParams();

  if (filters.baseAirportId) {
    search.set("base_airport_id", filters.baseAirportId);
  }
  if (filters.q) {
    search.set("q", filters.q);
  }
  if (filters.minRange) {
    search.set("min_range", filters.minRange);
  }
  if (filters.minCapacity) {
    search.set("min_capacity", filters.minCapacity);
  }
  if (filters.maxPrice) {
    search.set("max_price", filters.maxPrice);
  }
  if (filters.sort) {
    search.set("sort", filters.sort);
  }

  const query = search.toString();

  return apiClient.get<FleetMarketResponse>(`/fleet/market${query ? `?${query}` : ""}`);
}

export async function getFleetPurchasePreview(
  aircraftTypeId: string,
  baseAirportId: string,
  tailNumber: string,
): Promise<FleetPurchasePreviewResponse> {
  const search = new URLSearchParams({
    aircraft_type_id: aircraftTypeId,
    base_airport_id: baseAirportId,
    tail_number: tailNumber,
  });

  return apiClient.get<FleetPurchasePreviewResponse>(`/fleet/purchase-preview?${search.toString()}`);
}

export async function getFlights(): Promise<FlightsResponse> {
  return apiClient.get<FlightsResponse>("/operations/flights");
}

export async function getScheduleOptions(routeId?: string): Promise<ScheduleOptionsResponse> {
  const search = new URLSearchParams();
  if (routeId) {
    search.set("route_id", routeId);
  }
  const query = search.toString();

  return apiClient.get<ScheduleOptionsResponse>(`/operations/schedule-options${query ? `?${query}` : ""}`);
}

export async function getSchedulePreview(payload: {
  aircraft_id: string;
  days_of_week: number[];
  departure_local_time: string;
  route_id: string;
  turnaround_minutes: number;
}): Promise<SchedulePreviewResponse> {
  return apiClient.post<SchedulePreviewResponse>("/operations/schedule-preview", payload);
}

export async function purchaseFleetAircraft(payload: {
  aircraft_type_id: string;
  base_airport_id: string;
  tail_number: string;
}): Promise<FleetPurchaseResponse> {
  return apiClient.post<FleetPurchaseResponse>("/fleet/aircraft", payload);
}

export async function updateFleetAircraftTailNumber(
  id: string,
  tailNumber: string,
): Promise<FleetAircraftDetailResponse> {
  return apiClient.patch<FleetAircraftDetailResponse>(
    `/fleet/aircraft/${encodeURIComponent(id)}/tail-number`,
    {
      tail_number: tailNumber,
    },
  );
}
