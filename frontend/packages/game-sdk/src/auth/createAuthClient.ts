import type { DtoAccessTokenResponse } from "@airlinesim/api-contracts";

import type { AuthClient, AuthClientOptions, AuthSession, AuthTokenStorage } from "./types";

import { createApiClient } from "../api";
import { ApiRequestError } from "../errors";
import { createBrowserTokenStorage } from "./tokenStorage";

export function createAuthClient(options: AuthClientOptions = {}): AuthClient {
  const storage = options.storage ?? createBrowserTokenStorage();
  const apiClient =
    options.apiClient ??
    createApiClient({
      baseUrl: options.baseUrl,
      getToken: storage.get,
      timeoutMs: options.timeoutMs,
    });

  async function authenticate(
    path: "/auth/login" | "/auth/register",
    request: unknown,
  ): Promise<AuthSession> {
    const response = await apiClient.post<DtoAccessTokenResponse>(path, request, {
      withCredentials: true,
    });

    return persistAccessToken(response, storage);
  }

  return {
    getAccessToken: storage.get,
    isAuthenticated: () => Boolean(storage.get()),
    login: async (request) => authenticate("/auth/login", request),
    logout: () => storage.clear(),
    refresh: async () => {
      const response = await apiClient.post<DtoAccessTokenResponse>(
        "/auth/refresh",
        undefined,
        {
          withCredentials: true,
        },
      );

      return persistAccessToken(response, storage);
    },
    register: async (request) => authenticate("/auth/register", request),
    setAccessToken: (accessToken) => {
      if (accessToken) {
        storage.set(accessToken);
      } else {
        storage.clear();
      }
    },
  };
}

function persistAccessToken(
  response: DtoAccessTokenResponse,
  storage: AuthTokenStorage,
): AuthSession {
  const accessToken = response.access_token;

  if (!accessToken) {
    throw new ApiRequestError("Auth response did not include access_token", null, response);
  }

  storage.set(accessToken);

  return { accessToken };
}
