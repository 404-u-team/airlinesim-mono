import { createApiClient, createAuthClient } from "@airlinesim/game-sdk";

import type { FacilitiesOverview } from "./types";

const authClient = createAuthClient();
const apiClient = createApiClient({
  getToken: authClient.getAccessToken,
});

export async function getBaseFacilitiesOverview(): Promise<FacilitiesOverview> {
  return apiClient.get<FacilitiesOverview>("/facilities/base-overview");
}

