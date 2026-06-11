import type { BffConfig } from "../../../config";
import type { BackendEntity } from "../shared/types";
import { BackendHttpError, requestBackendJson } from "../../../backend-http";
import { errorDetails, type ImportLogger } from "../runtime/logger";

export type BackendSnapshot = {
  aircraftTypes: BackendEntity[];
  airports: BackendEntity[];
  countries: BackendEntity[];
  regions: BackendEntity[];
};

type RequestOptions = {
  body?: unknown;
  entityType?: string;
  log?: ImportLogger;
  method?: "GET" | "POST" | "PUT";
  sourceKey?: string;
  token: string;
};

export class BackendRequestError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly code?: string,
  ) {
    super(message);
    this.name = "BackendRequestError";
  }
}

export async function backendRequest<TValue>(
  config: BffConfig,
  path: string,
  options: RequestOptions,
): Promise<TValue> {
  const method = options.method ?? "GET";
  const startedAt = performance.now();
  options.log?.({
    details: { method, path },
    entityType: options.entityType,
    level: "info",
    message: "Calling backend",
    operation: "backend.request",
    sourceKey: options.sourceKey,
    stage: "importing",
  });
  try {
    const result = await requestBackendJson<TValue>(config, path, {
      body: options.body,
      headers: {
        Authorization: `Bearer ${options.token}`,
      },
      method,
    });
    options.log?.({
      details: { durationMs: Math.round(performance.now() - startedAt), method, path },
      entityType: options.entityType,
      level: "info",
      message: "Backend request completed",
      operation: "backend.request",
      sourceKey: options.sourceKey,
      stage: "importing",
    });
    return result;
  } catch (error) {
    const isConflict = error instanceof BackendHttpError && error.status === 409;
    options.log?.({
      details: { ...errorDetails(error), durationMs: Math.round(performance.now() - startedAt), method, path },
      entityType: options.entityType,
      level: isConflict ? "warning" : "error",
      message: isConflict ? "Backend request conflict" : "Backend request failed",
      operation: "backend.request",
      sourceKey: options.sourceKey,
      stage: "importing",
    });
    if (error instanceof BackendHttpError) {
      throw new BackendRequestError(error.message, error.status, error.code);
    }
    throw error;
  }
}

export function extractBackendId(payload: unknown): null | string {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const record = payload as Record<string, unknown>;
  const id = record.id ?? getNestedId(record, "data") ?? getNestedId(record, "result");

  return typeof id === "string" && id ? id : null;
}

export async function loadBackendSnapshot(config: BffConfig, token: string, log?: ImportLogger): Promise<BackendSnapshot> {
  const [countries, regions, airports, aircraftTypes] = await Promise.all([
    backendRequest<{ countries?: BackendEntity[] }>(config, "/countries", { log, token }),
    backendRequest<{ regions?: BackendEntity[] }>(config, "/regions", { log, token }),
    backendRequest<{ airports?: BackendEntity[] }>(config, "/airports", { log, token }),
    backendRequest<{ items?: BackendEntity[] }>(config, "/aircraft-types", { log, token }),
  ]);

  return {
    aircraftTypes: aircraftTypes.items ?? [],
    airports: airports.airports ?? [],
    countries: countries.countries ?? [],
    regions: regions.regions ?? [],
  };
}

function getNestedId(record: Record<string, unknown>, key: string): unknown {
  const nested = record[key];

  if (!nested || typeof nested !== "object") {
    return null;
  }

  return (nested as Record<string, unknown>).id;
}
