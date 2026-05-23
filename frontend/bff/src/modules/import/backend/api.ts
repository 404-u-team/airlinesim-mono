import type { BffConfig } from "../../../config";
import type { BackendEntity } from "../shared/types";

export type BackendSnapshot = {
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
  const startedAt = performance.now();
  let lastError: unknown;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    try {
      const response = await fetch(`${config.backendBaseUrl}${path}`, {
        body: options.body == null ? undefined : JSON.stringify(options.body),
        headers: {
          Authorization: `Bearer ${options.token}`,
          "Content-Type": "application/json",
        },
        method,
        signal: controller.signal,
      });

      if (response.ok) {
        console.warn(`${method} ${path} ${String(response.status)} ${String(Math.round(performance.now() - startedAt))}ms`);

        return (await response.json()) as TValue;
      }

      if (response.status !== 429 && response.status < 500) {
        throw new BackendRequestError(`Backend ${method} ${path} failed with ${String(response.status)}`, response.status);
      }

      lastError = new BackendRequestError(`Backend ${method} ${path} failed with ${String(response.status)}`, response.status);
    } catch (error) {
      lastError = error;
    } finally {
      clearTimeout(timeout);
    }

    await Bun.sleep(250 * 2 ** attempt);
  }

  throw lastError instanceof Error ? lastError : new Error(`Backend ${method} ${path} failed`);
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
  const [countries, regions, airports, regionLinks] = await Promise.all([
    backendRequest<{ countries?: BackendEntity[] }>(config, "/countries", { token }),
    backendRequest<{ regions?: BackendEntity[] }>(config, "/regions", { token }),
    backendRequest<{ airports?: BackendEntity[] }>(config, "/airports", { token }),
    backendRequest<{ region_links?: BackendEntity[] }>(config, "/region-links", { token }),
  ]);

  return {
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
