import type { BffConfig } from "../../config";

import { getUserAuthorization, requireValidUserToken } from "../../auth";
import { jsonResponse } from "../../http";

type CacheableRouteConfig = {
  backendPath: string;
  collectionKey: string;
  path: string;
  requiresAuth: boolean;
};

type CachedPayload = {
  fetchedAt: number;
  items: JsonObject[];
};

type JsonObject = Record<string, unknown>;

const maxBackendAttempts = 4;
const cacheableRoutes: CacheableRouteConfig[] = [
  {
    backendPath: "/aircraft-types",
    collectionKey: "items",
    path: "/aircraft-types",
    requiresAuth: true,
  },
  {
    backendPath: "/airports",
    collectionKey: "airports",
    path: "/airports",
    requiresAuth: true,
  },
  {
    backendPath: "/countries",
    collectionKey: "countries",
    path: "/countries",
    requiresAuth: true,
  },
  {
    backendPath: "/regions",
    collectionKey: "regions",
    path: "/regions",
    requiresAuth: true,
  },
  {
    backendPath: "/region-links",
    collectionKey: "region_links",
    path: "/region-links",
    requiresAuth: true,
  },
];
const cache = new Map<string, CachedPayload>();

export async function handleProxyRequest(
  request: Request,
  url: URL,
  config: BffConfig,
): Promise<null | Response> {
  const cacheableRoute = cacheableRoutes.find((route) => route.path === url.pathname);

  if (request.method === "GET" && cacheableRoute) {
    return handleCacheableRoute(request, url, config, cacheableRoute);
  }

  if (url.pathname.startsWith("/proxy/") && request.method === "GET") {
    const legacyPath = url.pathname.replace(/^\/proxy/, "");
    const legacyRoute = cacheableRoutes.find((route) => route.path === legacyPath);

    if (legacyRoute) {
      return handleCacheableRoute(request, url, config, legacyRoute);
    }
  }

  const response = await forwardBackendRequest(request, url, config);

  if (request.method !== "GET" && response.ok) {
    cache.clear();
  }

  return response;
}

function buildBackendHeaders(request: Request): Headers {
  const headers = new Headers();
  const authorization = getUserAuthorization(request);
  const contentType = request.headers.get("Content-Type");

  if (authorization) {
    headers.set("Authorization", authorization);
  }

  if (contentType) {
    headers.set("Content-Type", contentType);
  }

  return headers;
}

function filterItems(items: JsonObject[], searchParams: URLSearchParams): JsonObject[] {
  const query = normalizeSearchValue(searchParams.get("q"));
  const filters = Array.from(searchParams.entries())
    .filter(([key, value]) => key !== "q" && key !== "refresh" && value.trim() !== "")
    .map(([key, value]) => [key, normalizeSearchValue(value)] as const);

  return items.filter((item) => {
    if (query && !objectTextValues(item).some((value) => value.includes(query))) {
      return false;
    }

    return filters.every(([key, expected]) => {
      const actual = item[key];

      if (actual === undefined || actual === null) {
        return false;
      }

      if (typeof actual !== "boolean" && typeof actual !== "number" && typeof actual !== "string") {
        return false;
      }

      return normalizeSearchValue(String(actual)) === expected;
    });
  });
}

async function forwardBackendRequest(
  request: Request,
  url: URL,
  config: BffConfig,
): Promise<Response> {
  const backendUrl = new URL(`${config.backendBaseUrl}${url.pathname}`);
  backendUrl.search = url.search;
  const body = request.method === "GET" || request.method === "HEAD" ? undefined : await request.arrayBuffer();
  const backendResponse = await requestBackendWithRetry(backendUrl, {
    body,
    headers: buildBackendHeaders(request),
    method: request.method,
  });

  return cloneBackendResponse(backendResponse);
}

async function handleCacheableRoute(
  request: Request,
  url: URL,
  config: BffConfig,
  route: CacheableRouteConfig,
): Promise<Response> {
  if (route.requiresAuth) {
    const authError = await requireValidUserToken(request, config);

    if (authError) {
      return authError;
    }
  }

  const refresh = url.searchParams.get("refresh") === "true";
  const cachedPayload = refresh ? null : cache.get(route.path);
  const payload = cachedPayload ?? (await loadCacheableRoute(request, config, route));

  if (payload instanceof Response) {
    return payload;
  }
  const filteredItems = filterItems(payload.items, url.searchParams);

  return jsonResponse({
    meta: {
      cached: Boolean(cachedPayload),
      fetched_at: new Date(payload.fetchedAt).toISOString(),
      total: payload.items.length,
    },
    [route.collectionKey]: filteredItems,
  });
}

function cloneBackendResponse(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.delete("Content-Encoding");
  headers.delete("Content-Length");

  return new Response(response.body, {
    headers,
    status: response.status,
    statusText: response.statusText,
  });
}

async function loadCacheableRoute(
  request: Request,
  config: BffConfig,
  route: CacheableRouteConfig,
): Promise<CachedPayload | Response> {
  const response = await requestBackendWithRetry(`${config.backendBaseUrl}${route.backendPath}`, {
    headers: buildBackendHeaders(request),
    method: "GET",
  });

  if (!response.ok) {
    return jsonResponse({ error: "Backend request failed" }, { status: response.status });
  }

  const backendPayload = (await response.json()) as Record<string, unknown>;
  const items = backendPayload[route.collectionKey];
  const payload = {
    fetchedAt: Date.now(),
    items: Array.isArray(items) ? (items as JsonObject[]) : [],
  };

  cache.set(route.path, payload);

  return payload;
}

function normalizeSearchValue(value: null | string): string {
  return value?.trim().toLowerCase() ?? "";
}

function objectTextValues(item: JsonObject): string[] {
  return Object.values(item)
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.toLowerCase());
}

async function requestBackendWithRetry(input: string | URL, init: RequestInit): Promise<Response> {
  let response: null | Response = null;

  for (let attempt = 1; attempt <= maxBackendAttempts; attempt += 1) {
    response = await fetch(input, init);

    if (response.status !== 500) {
      return response;
    }
  }

  if (!response) {
    throw new Error("Backend request did not return a response");
  }

  return response;
}
