import { createApiClient, createAuthClient } from "@airlinesim/game-sdk";

export const authClient = createAuthClient();
export const apiClient = createApiClient({
  getToken: authClient.getAccessToken,
});
