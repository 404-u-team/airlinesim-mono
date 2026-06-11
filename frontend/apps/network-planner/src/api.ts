import { createApiClient, createAuthClient } from "@airlinesim/game-sdk";

import type {
  AirportSearchOption,
  CreateRouteResponse,
  HubItem,
  HubPreviewResponse,
  PriceAnalysisResponse,
  RouteDetailResponse,
  RouteOpportunitiesResponse,
  RoutePreviewResponse,
  RoutesResponse,
} from "./types";

const authClient = createAuthClient();
const apiClient = createApiClient({
  getToken: authClient.getAccessToken,
});

export type RouteOpportunityFilters = {
  aircraftId?: string;
  limit?: number;
  maxDistance?: string;
  minDemand?: string;
  onlyCompatible?: boolean;
  onlyProfitable?: boolean;
  originAirportId?: string;
};

export async function addHub(airportId: string): Promise<{ fee: number; hub: { airport_id: string } }> {
  return apiClient.post("/hubs", { airport_id: airportId });
}

export async function createRoute(payload: {
  base_frequency_per_week: number;
  destination_airport_id: string;
  fare_override_outbound?: number;
  fare_override_return?: number;
  origin_airport_id: string;
  selected_aircraft_id?: string;
}): Promise<CreateRouteResponse> {
  return apiClient.post<CreateRouteResponse>("/routes", payload);
}

export async function deleteRoute(routeId: string): Promise<{ route: unknown }> {
  return apiClient.delete<{ route: unknown }>(`/routes/${encodeURIComponent(routeId)}`);
}

export async function getHubPreview(airportId: string): Promise<HubPreviewResponse> {
  return apiClient.get<HubPreviewResponse>(`/hubs/preview?airport_id=${encodeURIComponent(airportId)}`);
}

export async function getHubs(): Promise<{ hubs: HubItem[] }> {
  return apiClient.get("/hubs");
}

export async function getRouteDetail(routeId: string): Promise<RouteDetailResponse> {
  return apiClient.get<RouteDetailResponse>(`/operations/routes/${encodeURIComponent(routeId)}/detail`);
}

export async function getRouteOpportunities(filters: RouteOpportunityFilters): Promise<RouteOpportunitiesResponse> {
  const search = new URLSearchParams();

  if (filters.minDemand) {
    search.set("min_demand", filters.minDemand);
  }
  if (filters.maxDistance) {
    search.set("max_distance", filters.maxDistance);
  }
  if (filters.onlyCompatible) {
    search.set("only_compatible", "true");
  }
  if (filters.onlyProfitable) {
    search.set("only_profitable", "true");
  }
  if (filters.aircraftId) {
    search.set("aircraft_id", filters.aircraftId);
  }
  if (filters.originAirportId) {
    search.set("origin_airport_id", filters.originAirportId);
  }
  if (filters.limit) {
    search.set("limit", String(filters.limit));
  }

  const query = search.toString();

  return apiClient.get<RouteOpportunitiesResponse>(`/routes/opportunities${query ? `?${query}` : ""}`);
}

export async function getRoutePreview(
  destinationAirportId: string,
  aircraftId?: string,
  originAirportId?: string,
): Promise<RoutePreviewResponse> {
  const search = new URLSearchParams();
  if (aircraftId) {
    search.set("aircraft_id", aircraftId);
  }
  if (originAirportId) {
    search.set("origin_airport_id", originAirportId);
  }

  const query = search.toString();

  return apiClient.get<RoutePreviewResponse>(
    `/routes/opportunities/${encodeURIComponent(destinationAirportId)}/preview${query ? `?${query}` : ""}`,
  );
}

export async function getRoutes(): Promise<RoutesResponse> {
  return apiClient.get<RoutesResponse>("/routes");
}

export async function removeHub(airportId: string): Promise<{ removed: boolean }> {
  return apiClient.delete(`/hubs/${encodeURIComponent(airportId)}`);
}

export async function requestPriceAnalysis(routeId: string): Promise<PriceAnalysisResponse> {
  return apiClient.post<PriceAnalysisResponse>(`/routes/${encodeURIComponent(routeId)}/price-analysis`, {});
}

export async function searchAirports(query: string): Promise<AirportSearchOption[]> {
  const response = await apiClient.get<{ airports: AirportSearchOption[] }>(`/onboarding/airports?q=${encodeURIComponent(query)}`);

  return response.airports;
}

export async function updateRouteFare(
  routeId: string,
  fare: { outbound: null | number; return: null | number },
): Promise<CreateRouteResponse> {
  return apiClient.patch<CreateRouteResponse>(`/routes/${encodeURIComponent(routeId)}`, {
    fare_override_outbound: fare.outbound,
    fare_override_return: fare.return,
  });
}
