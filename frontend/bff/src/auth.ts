import type { BffConfig } from "./config";

import { BackendHttpError, requestBackend, requestBackendJson } from "./backend-http";
import { jsonResponse } from "./http";

export type AdminCapability = "world.manage";

export type AdminCapabilityProbe = {
  authenticated: boolean;
  authorized: boolean;
  capabilities: AdminCapability[];
};

type AccessTokenResponse = {
  access_token?: string;
};

let adminAccessToken: null | string = null;
let adminAccessTokenExpiresAt: null | number = null;
let adminLoginPromise: null | Promise<string> = null;
const userAirlineByRequest = new WeakMap<Request, { airline: unknown; authorization: string }>();

export async function getAdminCapabilityProbe(
  request: Request,
  config: BffConfig,
): Promise<AdminCapabilityProbe> {
  const authorization = getUserAuthorization(request);

  if (!authorization) {
    return {
      authenticated: false,
      authorized: false,
      capabilities: [],
    };
  }

  try {
    await requestBackend(config, "/countries", {
      maxAttempts: 1,
      token: authorization,
    });

    return {
      authenticated: true,
      authorized: true,
      capabilities: ["world.manage"],
    };
  } catch (error) {
    if (error instanceof BackendHttpError && error.status === 403) {
      return {
        authenticated: true,
        authorized: false,
        capabilities: [],
      };
    }
    if (error instanceof BackendHttpError && error.status === 401) {
      return {
        authenticated: false,
        authorized: false,
        capabilities: [],
      };
    }

    throw error;
  }
}

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

export async function getValidatedUserAirline<TAirline>(
  request: Request,
  config: BffConfig,
): Promise<TAirline> {
  const authorization = getUserAuthorization(request);
  if (!authorization) {
    throw new BackendHttpError("Authentication required.", 401, "AUTH_REQUIRED", false);
  }

  const cached = userAirlineByRequest.get(request);
  if (cached?.authorization === authorization) {
    return cached.airline as TAirline;
  }

  const airline = await requestBackendJson<TAirline>(config, "/airline/me", { token: authorization });
  userAirlineByRequest.set(request, { airline, authorization });

  return airline;
}

export function invalidateBackendAdminToken(): void {
  adminAccessToken = null;
  adminAccessTokenExpiresAt = null;
}

export async function requireAdminCapability(
  request: Request,
  config: BffConfig,
  capability: AdminCapability,
): Promise<null | Response> {
  const probe = await getAdminCapabilityProbe(request, config);

  if (!probe.authenticated) {
    return jsonResponse(
      {
        error: {
          code: "AUTH_REQUIRED",
          message: "Authentication required.",
          retryable: false,
        },
      },
      { status: 401 },
    );
  }
  if (!probe.capabilities.includes(capability)) {
    return jsonResponse(
      {
        error: {
          code: "ADMIN_ACCESS_REQUIRED",
          message: "Admin access is required.",
          retryable: false,
        },
      },
      { status: 403 },
    );
  }

  return null;
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
    await getValidatedUserAirline(request, config);
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
