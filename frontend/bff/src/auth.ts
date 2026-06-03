import type { BffConfig } from "./config";

import { BackendHttpError, requestBackend, requestBackendJson } from "./backend-http";
import { jsonResponse } from "./http";

type AccessTokenResponse = {
  access_token?: string;
};

let adminAccessToken: null | string = null;
let adminAccessTokenExpiresAt: null | number = null;
let adminLoginPromise: null | Promise<string> = null;

export async function getBackendAdminToken(config: BffConfig): Promise<string> {
  if (adminAccessToken && !isTokenExpiringSoon(adminAccessTokenExpiresAt)) {
    return adminAccessToken;
  }

  adminLoginPromise ??= loginBackendAdmin(config)
    .then((token) => {
      adminAccessToken = token;
      adminAccessTokenExpiresAt = getJwtExpiresAt(token);

      return token;
    })
    .finally(() => {
      adminLoginPromise = null;
    });

  return adminLoginPromise;
}

export function getUserAuthorization(request: Request): null | string {
  const authorization = request.headers.get("Authorization");

  if (!authorization?.startsWith("Bearer ")) {
    return null;
  }

  return authorization;
}

export function invalidateBackendAdminToken(): void {
  adminAccessToken = null;
  adminAccessTokenExpiresAt = null;
}

export async function requireValidUserToken(
  request: Request,
  config: BffConfig,
): Promise<null | Response> {
  const authorization = getUserAuthorization(request);

  if (!authorization) {
    return jsonResponse({ error: "Missing user token" }, { status: 401 });
  }

  try {
    // GET request will be retried automatically by requestBackend
    const response = await requestBackend(config, "/airline/me", {
      token: authorization,
    });

    if (response.status === 401 || response.status === 403) {
      return jsonResponse({ error: "Invalid user token" }, { status: 401 });
    }
  } catch (error) {
    if (error instanceof BackendHttpError) {
      if (error.status === 401 || error.status === 403) {
        return jsonResponse({ error: "Invalid user token" }, { status: 401 });
      }
      if (error.status === 404) {
        return null;
      }
      return jsonResponse(error.toNormalizedJson(), { status: error.status });
    }
    return jsonResponse(
      {
        error: {
          code: "BACKEND_UNAVAILABLE",
          message: error instanceof Error ? error.message : "Authentication check failed.",
          retryable: true,
        },
      },
      { status: 503 },
    );
  }

  return null;
}

function getJwtExpiresAt(token: string): null | number {
  const payload = token.split(".")[1];
  if (!payload) {
    return null;
  }

  try {
    const normalized = payload.replaceAll("-", "+").replaceAll("_", "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const decoded = JSON.parse(atob(padded)) as { exp?: unknown };

    return typeof decoded.exp === "number" ? decoded.exp * 1000 : null;
  } catch {
    return null;
  }
}

function isTokenExpiringSoon(expiresAt: null | number): boolean {
  return expiresAt !== null && expiresAt - Date.now() < 30_000;
}

async function loginBackendAdmin(config: BffConfig): Promise<string> {
  if (!config.backendAdminLogin || !config.backendAdminPassword) {
    throw new Error("BFF backend admin credentials are not configured");
  }

  const payload = await requestBackendJson<AccessTokenResponse>(config, "/auth/login", {
    body: {
      login: config.backendAdminLogin,
      password: config.backendAdminPassword,
    },
    method: "POST",
  });

  if (!payload.access_token) {
    throw new Error("BFF backend admin login response did not include access_token");
  }

  return payload.access_token;
}
