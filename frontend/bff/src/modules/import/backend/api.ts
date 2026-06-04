import type { BffConfig } from "../../../config";
import type { BackendEntity } from "../shared/types";
import { BackendHttpError, requestBackendJson } from "../../../backend-http";

export type BackendSnapshot = {
  aircraftTypes: BackendEntity[];
  airports: BackendEntity[];
  countries: BackendEntity[];
  regionLinks: BackendEntity[];
  regions: BackendEntity[];
};

type RequestOptions = {
  body?: unknown;
  method?: "GET" | "POST" | "PUT";
  token: string;
};

export class BackendRequestError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
  }
}

export async function backendRequest<TValue>(
  config: BffConfig,
  path: string,
  options: RequestOptions,
): Promise<TValue> {
  const method = options.method ?? "GET";
  try {
    return await requestBackendJson<TValue>(config, path, {
      body: options.body,
      headers: {
        Authorization: `Bearer ${options.token}`,
      },
      method,
    });
  } catch (error) {
    if (error instanceof BackendHttpError) {
      throw new BackendRequestError(error.message, error.status);
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

export async function loadBackendSnapshot(config: BffConfig, token: string): Promise<BackendSnapshot> {
  const [countries, regions, airports, regionLinks, aircraftTypes] = await Promise.all([
    backendRequest<{ countries?: BackendEntity[] }>(config, "/countries", { token }),
    backendRequest<{ regions?: BackendEntity[] }>(config, "/regions", { token }),
    backendRequest<{ airports?: BackendEntity[] }>(config, "/airports", { token }),
    backendRequest<{ region_links?: BackendEntity[] }>(config, "/region-links", { token }),
    backendRequest<{ items?: BackendEntity[] }>(config, "/aircraft-types", { token }),
  ]);

  return {
    aircraftTypes: aircraftTypes.items ?? [],
    airports: airports.airports ?? [],
    countries: countries.countries ?? [],
    regionLinks: regionLinks.region_links ?? [],
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
