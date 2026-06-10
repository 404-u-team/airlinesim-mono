import { createApiClient } from "@airlinesim/game-sdk";

import type { AircraftImageCandidate, AircraftType, CreateAircraftTypePayload } from "../types";

import { authState } from "../../auth";

const apiClient = createApiClient({
  getToken: () => authState.accessToken.value,
});

export async function clearAircraftImage(icao: string): Promise<{ success: boolean }> {
  return apiClient.delete<{ success: boolean }>(
    `/admin/aircraft-types/${encodeURIComponent(icao)}/image`
  );
}

export async function createAircraftType(payload: CreateAircraftTypePayload): Promise<AircraftType> {
  return apiClient.post<AircraftType>("/aircraft-types", payload);
}

export async function getAircraftType(id: string): Promise<AircraftType> {
  return apiClient.get<AircraftType>(`/aircraft-types/${encodeURIComponent(id)}`);
}

export async function listAircraftTypes(): Promise<{ items: AircraftType[] }> {
  return apiClient.get<{ items: AircraftType[] }>("/aircraft-types");
}

export async function searchAircraftImages(
  q: string,
  config?: { signal?: AbortSignal; timeout?: number; }
): Promise<{ candidates: AircraftImageCandidate[] }> {
  return apiClient.get<{ candidates: AircraftImageCandidate[] }>(
    `/admin/aircraft-types/images/search?q=${encodeURIComponent(q)}`,
    config
  );
}

export async function setAircraftImage(
  icao: string,
  body: { imageUrl: string; pageUrl?: string; source?: string; title?: string; }
): Promise<AircraftImageCandidate> {
  return apiClient.put<AircraftImageCandidate>(
    `/admin/aircraft-types/${encodeURIComponent(icao)}/image`,
    body
  );
}
