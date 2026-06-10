import type { DashboardFlightDetail, DashboardMapState, DashboardSummary } from "./types";

import { apiClient } from "../api";

export async function getDashboardMapState(selectedAirportId?: string): Promise<DashboardMapState> {
  const search = new URLSearchParams({
    include_opportunities: "true",
    scope: "dashboard",
  });

  if (selectedAirportId) {
    search.set("selected_airport_id", selectedAirportId);
  }

  return apiClient.get<DashboardMapState>(`/game/map-state?${search.toString()}`);
}

export async function getDashboardSummary(): Promise<DashboardSummary> {
  return apiClient.get<DashboardSummary>("/game/dashboard-summary");
}

export async function getFlightDetail(flightId: string): Promise<DashboardFlightDetail> {
  return apiClient.get<DashboardFlightDetail>(`/operations/flights/${encodeURIComponent(flightId)}`);
}
