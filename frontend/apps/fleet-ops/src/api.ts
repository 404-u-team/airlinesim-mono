import { createApiClient, createAuthClient } from "@airlinesim/game-sdk";

import type {
  CreateRouteResponse,
  CreateScheduleResponse,
  FleetAircraftDetailResponse,
  FleetAircraftResponse,
  FleetMarketResponse,
  FleetPurchasePreviewResponse,
  FleetPurchaseResponse,
  FlightCard,
  FlightDetailResponse,
  FlightsResponse,
  FuelHistoryResponse,
  FuelPriceSnapshot,
  FuelPurchaseResult,
  FuelStorageResponse,
  HubsResponse,
  ReplaceScheduleResponse,
  RouteOpportunitiesResponse,
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

export async function cancelFlight(id: string): Promise<{ flight: unknown }> {
  return apiClient.post<{ flight: unknown }>(`/operations/flights/${encodeURIComponent(id)}/cancel`, {});
}

export async function completeFlight(id: string): Promise<{ flight: unknown }> {
  return apiClient.post<{ flight: unknown }>(`/operations/flights/${encodeURIComponent(id)}/complete`, {});
}

export async function createFerryFlight(payload: {
  aircraft_id: string;
  departure_date: string;
  departure_local_time: string;
  destination_airport_id: string;
}): Promise<{ flight: FlightCard }> {
  return apiClient.post<{ flight: FlightCard }>("/operations/ferry-flights", payload);
}

export async function createRoute(payload: {
  base_frequency_per_week: number;
  destination_airport_id: string;
  origin_airport_id: string;
  selected_aircraft_id?: string;
}): Promise<CreateRouteResponse> {
  return apiClient.post<CreateRouteResponse>("/routes", payload);
}

export async function createSchedule(payload: {
  aircraft_id: string;
  days_of_week: number[];
  departure_local_time: string;
  round_trip: boolean;
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

export async function getFlightDetail(flightId: string): Promise<FlightDetailResponse> {
  return apiClient.get<FlightDetailResponse>(`/operations/flights/${encodeURIComponent(flightId)}`);
}

export async function getFlights(): Promise<FlightsResponse> {
  return apiClient.get<FlightsResponse>("/operations/flights");
}

export async function getFuelHistory(): Promise<FuelHistoryResponse> {
  return apiClient.get<FuelHistoryResponse>("/fuel/history");
}

export async function getFuelPrice(): Promise<FuelPriceSnapshot> {
  return apiClient.get<FuelPriceSnapshot>("/fuel/price");
}

export async function getFuelStorage(): Promise<FuelStorageResponse> {
  return apiClient.get<FuelStorageResponse>("/fuel/storage");
}

export async function getHubs(): Promise<HubsResponse> {
  return apiClient.get<HubsResponse>("/hubs");
}

export async function getRouteOpportunities(originAirportId: string, aircraftId?: string): Promise<RouteOpportunitiesResponse> {
  const search = new URLSearchParams({ limit: "200", origin_airport_id: originAirportId });
  if (aircraftId) {
    search.set("aircraft_id", aircraftId);
  }

  return apiClient.get<RouteOpportunitiesResponse>(`/routes/opportunities?${search.toString()}`);
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
  round_trip: boolean;
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

export async function purchaseFuelTonnes(tonnes: number): Promise<FuelPurchaseResult> {
  return apiClient.post<FuelPurchaseResult>("/fuel/storage/purchase", { tonnes });
}

export async function replaceAircraftSchedule(payload: {
  aircraft_id: string;
  blocks: Array<{ day: number; departure_local_time: string; round_trip?: boolean; route_id: string }>;
  round_trip: boolean;
  turnaround_minutes: number;
}): Promise<ReplaceScheduleResponse> {
  return apiClient.put<ReplaceScheduleResponse>("/operations/schedules", payload);
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
