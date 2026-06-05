import type { BffConfig } from "../../config";

import { getUserAuthorization, requireAdminCapability, requireValidUserToken } from "../../auth";
import { BackendHttpError, requestBackend } from "../../backend-http";
import { jsonResponse } from "../../http";

type CacheableRouteConfig = {
  backendPath: string;
  collectionKey: string;
  fallbackEmptyOnError?: boolean;
  path: string;
  requiresAuth: boolean;
};

type CachedPayload = {
  fetchedAt: number;
  items: JsonObject[];
};

type JsonObject = Record<string, unknown>;

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
    fallbackEmptyOnError: true,
    path: "/region-links",
    requiresAuth: true,
  },
];
const cache = new Map<string, CachedPayload>();

// Export cache and loadCacheableRoute helper for use in onboarding or other modules
export { cache, cacheableRoutes };

export async function getCachedListInternal<T>(
  request: Request,
  config: BffConfig,
  path: string,
  _collectionKey: string,
): Promise<T[]> {
  const cachedPayload = cache.get(path);
  if (cachedPayload) {
    return cachedPayload.items as T[];
  }

  // Load fresh
  const route = cacheableRoutes.find((r) => r.path === path);
  if (!route) {
    throw new Error(`Route configuration not found for cacheable path: ${path}`);
  }

  const result = await loadCacheableRouteInternal(request, config, route);
  return result.items as T[];
}

export async function handleProxyRequest(
  request: Request,
  url: URL,
  config: BffConfig,
): Promise<null | Response> {
  if (isAdminMutation(request, url)) {
    const authError = await requireAdminCapability(request, config, "world.manage");
    if (authError) {
      return authError;
    }
  }

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

function isAdminMutation(request: Request, url: URL): boolean {
  if (request.method === "GET" || request.method === "HEAD") {
    return false;
  }

  return /^\/(?:airport|country|region|region-link)(?:\/|$)/.test(url.pathname);
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

// Pagination/control params are not item fields; treating them as exact-match
// filters would wrongly empty the whole collection.
const nonFilterParams = new Set(["cursor", "limit", "offset", "order", "page", "page_size", "per_page", "q", "refresh", "sort"]);

function filterItems(items: JsonObject[], searchParams: URLSearchParams): JsonObject[] {
  const query = normalizeSearchValue(searchParams.get("q"));
  const filters = Array.from(searchParams.entries())
    .filter(([key, value]) => !nonFilterParams.has(key) && value.trim() !== "")
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
  try {
    const body = request.method === "GET" || request.method === "HEAD" ? undefined : await request.arrayBuffer();
    const response = await requestBackend(config, url.pathname + url.search, {
      body,
      headers: buildBackendHeaders(request),
      method: request.method as "DELETE" | "GET" | "HEAD" | "PATCH" | "POST" | "PUT",
    });

    return cloneBackendResponse(response);
  } catch (error) {
    if (error instanceof BackendHttpError) {
      return jsonResponse(error.toNormalizedJson(), { status: error.status });
    }

    return jsonResponse(
      {
        error: {
          code: "BACKEND_UNAVAILABLE",
          message: error instanceof Error ? error.message : String(error),
          retryable: true,
        },
      },
      { status: 503 },
    );
  }
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
  let payload: CachedPayload | Response;

  if (cachedPayload) {
    payload = cachedPayload;
  } else {
    try {
      payload = await loadCacheableRouteInternal(request, config, route);
    } catch (error) {
      const stalePayload = cache.get(route.path);
      if (stalePayload) {
        return listResponse(route, stalePayload, url.searchParams, {
          cached: true,
          degraded: true,
          errorCode: error instanceof BackendHttpError ? error.code : "BACKEND_UNAVAILABLE",
          stale: true,
        });
      }
      if (route.fallbackEmptyOnError) {
        return degradedListResponse(route, error);
      }
      if (error instanceof BackendHttpError) {
        return jsonResponse(error.toNormalizedJson(), { status: error.status });
      }
      return jsonResponse(
        {
          error: {
            code: "BACKEND_UNAVAILABLE",
            message: error instanceof Error ? error.message : String(error),
            retryable: true,
          },
        },
        { status: 503 },
      );
    }
  }

  if (payload instanceof Response) {
    return payload;
  }

  return listResponse(route, payload, url.searchParams, {
    cached: Boolean(cachedPayload),
  });
}

function listResponse(
  route: CacheableRouteConfig,
  payload: CachedPayload,
  searchParams: URLSearchParams,
  options: {
    cached: boolean;
    degraded?: boolean;
    errorCode?: string;
    stale?: boolean;
  },
): Response {
  const filteredItems = filterItems(payload.items, searchParams);

  return jsonResponse({
    meta: {
      cached: options.cached,
      degraded: options.degraded ?? false,
      error_code: options.errorCode,
      fetched_at: new Date(payload.fetchedAt).toISOString(),
      stale: options.stale ?? false,
      total: payload.items.length,
    },
    [route.collectionKey]: filteredItems,
  });
}

function degradedListResponse(route: CacheableRouteConfig, error: unknown): Response {
  return jsonResponse({
    meta: {
      cached: false,
      degraded: true,
      error_code: error instanceof BackendHttpError ? error.code : "BACKEND_UNAVAILABLE",
      fetched_at: new Date().toISOString(),
      total: 0,
    },
    [route.collectionKey]: [],
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

async function loadCacheableRouteInternal(
  request: Request,
  config: BffConfig,
  route: CacheableRouteConfig,
): Promise<CachedPayload> {
  const response = await requestBackend(config, route.backendPath, {
    headers: buildBackendHeaders(request),
    method: "GET",
  });

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

// Helper to extract text search fields
function objectTextValues(item: JsonObject): string[] {
  return Object.values(item)
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.toLowerCase());
}
