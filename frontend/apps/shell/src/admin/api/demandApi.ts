import { createApiClient } from "@airlinesim/game-sdk";

import type { CalibrationArtifact, CalibrationJobStatus } from "../types";

import { authState } from "../../auth";

const apiClient = createApiClient({
  getToken: () => authState.accessToken.value,
});

export async function getCalibration(): Promise<CalibrationArtifact> {
  return apiClient.get<CalibrationArtifact>("/admin/demand/calibration");
}

export async function getCalibrationJob(jobId: string): Promise<{ job: CalibrationJobStatus }> {
  return apiClient.get<{ job: CalibrationJobStatus }>(`/admin/demand/calibrate/jobs/${encodeURIComponent(jobId)}`);
}

export async function getCountries(): Promise<{ countries: Array<{ id: string; intl_name: string; iso: string; local_name: string }> }> {
  return apiClient.get("/admin/world/countries");
}

export async function getLatestCalibrationJob(): Promise<null | { job: CalibrationJobStatus }> {
  try {
    return await apiClient.get<{ job: CalibrationJobStatus }>("/admin/demand/calibrate/status");
  } catch {
    return null;
  }
}

export async function runCalibration(refresh: boolean): Promise<{ jobId: string; status: string }> {
  return apiClient.post<{ jobId: string; status: string }>("/admin/demand/calibrate", { refresh });
}

