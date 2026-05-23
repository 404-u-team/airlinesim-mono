import type { BffConfig } from "./config";

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

  const response = await fetch(`${config.backendBaseUrl}/airline/me`, {
    headers: {
      Authorization: authorization,
    },
  });

  if (response.status === 401 || response.status === 403) {
    return jsonResponse({ error: "Invalid user token" }, { status: 401 });
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

  const response = await fetch(`${config.backendBaseUrl}/auth/login`, {
    body: JSON.stringify({
      login: config.backendAdminLogin,
      password: config.backendAdminPassword,
    }),
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  if (!response.ok) {
    throw new Error("BFF backend admin login failed");
  }

  const payload = (await response.json()) as AccessTokenResponse;

  if (!payload.access_token) {
    throw new Error("BFF backend admin login response did not include access_token");
  }

  return payload.access_token;
}
