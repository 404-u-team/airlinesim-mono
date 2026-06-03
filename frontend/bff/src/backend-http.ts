/* eslint-disable no-await-in-loop */
import type { BffConfig } from "./config";

export type RequestBackendOptions = {
  body?: unknown;
  headers?: Headers | Record<string, string>;
  maxAttempts?: number;
  method?: "DELETE" | "GET" | "HEAD" | "PATCH" | "POST" | "PUT";
  retryMutating?: boolean;
  timeoutMs?: number;
  token?: string;
};

export class BackendHttpError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
    public readonly retryable: boolean,
    public readonly details: unknown = null,
  ) {
    super(message);
    this.name = "BackendHttpError";
  }

  public toNormalizedJson(): { error: { code: string; message: string; retryable: boolean } } {
    return {
      error: {
        code: this.code,
        message: this.message,
        retryable: this.retryable,
      },
    };
  }
}

export function normalizeBackendError(
  status: number,
  body: unknown,
  pathname: string,
): { code: string; message: string; retryable: boolean } {
  const retryable = [408, 429, 500, 502, 503, 504].includes(status);
  const norm = getInitialErrorCodeAndMessage(status, pathname, body);
  let { message } = norm;

  // Fallback to backend message if present
  if (body && typeof body === "object") {
    const record = body as Record<string, unknown>;
    if (typeof record.error === "string" && record.error) {
      message = record.error;
    } else if (typeof record.message === "string" && record.message) {
      message = record.message;
    }
  }

  return { code: norm.code, message, retryable };
}

export async function requestBackend(
  config: BffConfig,
  path: string,
  options: RequestBackendOptions = {},
): Promise<Response> {
  const method = options.method ?? "GET";
  const timeoutMs = options.timeoutMs ?? 10_000;
  const maxAttempts = options.maxAttempts ?? 3;
  const url = `${config.backendBaseUrl}${path}`;

  let lastError: unknown = null;
  let lastResponse: null | Response = null;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        body: buildBackendRequestBody(options.body),
        headers: buildBackendRequestHeaders(options),
        method,
        signal: controller.signal,
      });

      lastResponse = response;

      if (response.ok) {
        return response;
      }

      const { status } = response;
      if (!shouldRetryAttempt(status, method, path, options.retryMutating)) {
        await handleResponseError(response, status, path);
      }

      lastError = new Error(`Request to ${path} failed with status ${String(status)}`);
    } catch (error) {
      lastError = error;
    } finally {
      clearTimeout(timeout);
    }

    if (attempt < maxAttempts - 1) {
      const delay = 250 * 2 ** attempt + Math.random() * 50;
      await Bun.sleep(delay);
    }
  }

  return await throwFinalBackendError(lastResponse, lastError, path);
}

export async function requestBackendJson<TValue>(
  config: BffConfig,
  path: string,
  options: RequestBackendOptions = {},
): Promise<TValue> {
  const response = await requestBackend(config, path, options);
  return (await response.json()) as TValue;
}

function buildBackendRequestBody(body?: unknown): ArrayBuffer | Blob | string | undefined {
  if (body == null) {
    return undefined;
  }
  if (body instanceof ArrayBuffer || body instanceof Blob || typeof body === "string") {
    return body;
  }
  return JSON.stringify(body);
}

function buildBackendRequestHeaders(options: RequestBackendOptions): Headers {
  const headers = new Headers(options.headers);
  if (options.token) {
    headers.set("Authorization", options.token.startsWith("Bearer ") ? options.token : `Bearer ${options.token}`);
  }
  if (options.body != null && !headers.has("Content-Type") && !(options.body instanceof ArrayBuffer)) {
    headers.set("Content-Type", "application/json");
  }
  if (!headers.has("Accept")) {
    headers.set("Accept", "application/json");
  }
  return headers;
}

function getInitialErrorCodeAndMessage(
  status: number,
  pathname: string,
  body: unknown,
): { code: string; message: string } {
  const isAuth = pathname.includes("/auth/");
  const isAirline = pathname.includes("/airline") || pathname.includes("/onboarding/airline");
  const isOnboarding = pathname.includes("/onboarding");

  if (status >= 500) {
    return {
      code: "BACKEND_UNAVAILABLE",
      message: "The server is temporarily unavailable. Please try again later.",
    };
  }
  if (status === 408) {
    return { code: "REQUEST_TIMEOUT", message: "The request timed out. Please try again." };
  }
  if (status === 429) {
    return { code: "RATE_LIMIT_EXCEEDED", message: "Too many requests. Please wait a moment." };
  }
  if (isAuth) {
    return normalizeAuthError(status);
  }
  if (isAirline || isOnboarding) {
    return normalizeAirlineError(status, body);
  }
  return normalizeGenericError(status);
}

async function handleResponseError(
  response: Response,
  status: number,
  path: string,
): Promise<never> {
  let errorBody: unknown = null;
  try {
    errorBody = await response.json();
  } catch {
    // not json
  }
  const normalized = normalizeBackendError(status, errorBody, path);
  throw new BackendHttpError(normalized.message, status, normalized.code, normalized.retryable, errorBody);
}

function isAirlineCodeConflict(body: unknown): boolean {
  if (!body || typeof body !== "object") {
    return false;
  }
  const record = body as Record<string, unknown>;
  const err = typeof record.error === "string" ? record.error : "";
  const msg = typeof record.message === "string" ? record.message : "";
  const patterns = ["code", "iata", "icao"];
  return patterns.some((pat) => err.includes(pat) || msg.includes(pat));
}

function normalizeAirlineError(status: number, body: unknown): { code: string; message: string } {
  if (status === 404) {
    return { code: "AIRLINE_NOT_FOUND", message: "Airline not found." };
  }
  if (status === 409) {
    const code = isAirlineCodeConflict(body) ? "AIRLINE_CODE_EXISTS" : "AIRLINE_CONFLICT";
    return { code, message: "Airline name or code already exists." };
  }
  if (status === 422) {
    return { code: "AIRLINE_VALIDATION_FAILED", message: "Invalid airline creation parameters." };
  }
  if (status === 400 || status === 401) {
    return { code: "AUTH_REQUIRED", message: "Authentication required." };
  }
  return { code: "UNKNOWN_ERROR", message: "An unknown airline error occurred." };
}

function normalizeAuthError(status: number): { code: string; message: string } {
  if (status === 400 || status === 401) {
    return { code: "AUTH_INVALID_CREDENTIALS", message: "Check credentials and try again." };
  }
  if (status === 409) {
    return { code: "AUTH_ACCOUNT_EXISTS", message: "Account already exists." };
  }
  if (status === 422) {
    return { code: "AUTH_VALIDATION_FAILED", message: "Validation failed. Please check the entered data." };
  }
  return { code: "UNKNOWN_ERROR", message: "An unknown auth error occurred." };
}

function normalizeGenericError(status: number): { code: string; message: string } {
  if (status === 401 || status === 403) {
    return { code: "UNAUTHORIZED", message: "Access denied." };
  }
  if (status === 404) {
    return { code: "NOT_FOUND", message: "Resource not found." };
  }
  return { code: "UNKNOWN_ERROR", message: "An unknown error occurred." };
}

function shouldRetryAttempt(
  status: number,
  method: string,
  path: string,
  retryMutating?: boolean,
): boolean {
  const isRetryableStatus = [408, 429, 500, 502, 503, 504].includes(status);
  const isSafeMethod = method === "GET" || method === "HEAD";
  const isAuthPath = path.includes("/auth/login") || path.includes("/auth/register") || path.includes("/auth/refresh");

  return isRetryableStatus && (isSafeMethod || isAuthPath || Boolean(retryMutating));
}

async function throwFinalBackendError(
  lastResponse: null | Response,
  lastError: unknown,
  path: string,
): Promise<never> {
  const status = lastResponse?.status ?? 503;
  let errorBody: unknown = null;
  if (lastResponse) {
    try {
      errorBody = await lastResponse.json();
    } catch {
      // not json
    }
  }
  const normalized = normalizeBackendError(status, errorBody, path);
  const details = errorBody ?? (lastError instanceof Error ? lastError.message : String(lastError));
  throw new BackendHttpError(
    normalized.message,
    status,
    normalized.code,
    normalized.retryable,
    details,
  );
}
