import { createApiClient } from "@airlinesim/game-sdk";

import { authState } from "../../auth";

export type LatestImportJob = {
  finishedAt?: string;
  id: string;
  mode: "dry-run" | "import";
  startedAt: string;
  status: "failed" | "queued" | "running" | "succeeded";
};

const apiClient = createApiClient({ getToken: () => authState.accessToken.value });

export async function getLatestImportJob(): Promise<LatestImportJob | null> {
  try {
    return (await apiClient.get<{ job: LatestImportJob }>("/admin/import/world-data/status")).job;
  } catch {
    return null;
  }
}
