import type { BffConfig } from "./config";

import { jsonResponse } from "./http";

type AccessTokenResponse = {
  access_token?: string;
};

let adminAccessToken: null | string = null;
let adminLoginPromise: null | Promise<string> = null;

export async function getBackendAdminToken(config: BffConfig): Promise<string> {
  if (adminAccessToken) {
    return adminAccessToken;
  }

   
  adminLoginPromise ??= loginBackendAdmin(config);

  try {
    // eslint-disable-next-line require-atomic-updates
    adminAccessToken = await adminLoginPromise;

    return adminAccessToken;
  } finally {
    // eslint-disable-next-line require-atomic-updates
    adminLoginPromise = null;
  }
}

export function getUserAuthorization(request: Request): null | string {
  const authorization = request.headers.get("Authorization");

  if (!authorization?.startsWith("Bearer ")) {
    return null;
  }

  return authorization;
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
