import { createApiClient } from "@airlinesim/game-sdk";

import { authState } from "../../auth";

const apiClient = createApiClient({
  getToken: () => authState.accessToken.value,
});

export type AdminAirline = {
  created_at: string;
  id: string;
  last_seen_at: string;
  name: string;
};

export type AdminAirlineDetail = {
  airline: null | Record<string, unknown>;
  operations_delta: number;
  registry: AdminAirline | null;
};

export async function creditAirline(
  airlineId: string,
  payload: { amount: number; note?: string },
): Promise<{ operations_delta: number }> {
  return apiClient.post<{ operations_delta: number }>(`/admin/airlines/${encodeURIComponent(airlineId)}/credit`, payload);
}

export async function getAirlineDetail(airlineId: string): Promise<AdminAirlineDetail> {
  return apiClient.get<AdminAirlineDetail>(`/admin/airlines/${encodeURIComponent(airlineId)}`);
}

export async function listAirlines(): Promise<{ airlines: AdminAirline[] }> {
  return apiClient.get<{ airlines: AdminAirline[] }>("/admin/airlines");
}
