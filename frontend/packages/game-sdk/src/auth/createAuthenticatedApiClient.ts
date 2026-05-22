import type { AuthClient, AuthClientOptions } from "./types";

import { type ApiClient, createApiClient } from "../api";
import { createAuthClient } from "./createAuthClient";
import { createBrowserTokenStorage } from "./tokenStorage";

export function createAuthenticatedApiClient(options: AuthClientOptions = {}): {
  apiClient: ApiClient;
  authClient: AuthClient;
} {
  const storage = options.storage ?? createBrowserTokenStorage();
  const authContext: { client?: AuthClient } = {};

  const apiClient = createApiClient({
    baseUrl: options.baseUrl,
    getToken: storage.get,
    refreshToken: async () => {
      try {
        const session = await authContext.client?.refresh();

        return session?.accessToken ?? null;
      } catch {
        storage.clear();

        return null;
      }
    },
    timeoutMs: options.timeoutMs,
  });

  const authClient = createAuthClient({
    apiClient,
    storage,
  });
  authContext.client = authClient;

  return { apiClient, authClient };
}
