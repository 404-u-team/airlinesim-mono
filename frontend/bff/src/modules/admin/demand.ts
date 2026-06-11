import type { BffConfig } from "../../config";

import { getBackendAdminToken, requireAdminCapability } from "../../auth";
import { BackendHttpError } from "../../backend-http";
import { parseGeoPoint } from "../../geo";
import { jsonResponse } from "../../http";
import { loadCalibration } from "../demand/calibration";
import {
  getCalibrationJobStatus,
  getLatestCalibrationJobStatus,
  startCalibrationJob,
} from "../demand/calibration-jobs";
import { computeAirportPairDemand, type DemandAirportInput, type DemandRegionInput } from "../demand/service";
import { backendRequest } from "../import/backend/api";
import { distanceKm } from "../import/shared/math";
import { adminActorId } from "./audit";

// Backend airport row: DemandAirportInput plus the geo the model needs for distance.
type PairAirport = DemandAirportInput & { geog?: string; geom?: string; intl_name?: string };

export function getRouteAction(method: string, pathname: string): null | string {
  if (pathname === "/admin/demand/calibration") {
    return method === "GET" ? "get-calibration" : "bad-method";
  }
  if (pathname === "/admin/demand/calibrate") {
    return method === "POST" ? "start-calibrate" : "bad-method";
  }
  if (pathname === "/admin/demand/calibrate/status") {
    return method === "GET" ? "get-latest" : "bad-method";
  }
  if (pathname.startsWith("/admin/demand/calibrate/jobs/")) {
    return method === "GET" ? "get-job" : "bad-method";
  }
  if (pathname === "/admin/demand/pair") {
    return method === "GET" ? "get-pair" : "bad-method";
  }
  return null;
}

// Admin demand routes (Layer 2 calibration). Self-contained and registered in the
// server router so admin/index.ts stays untouched. Gated by `world.manage`.
// See docs/passenger-demand-model.md "Калибровка".
export async function handleAdminDemandRequest(
  request: Request,
  url: URL,
  config: BffConfig,
): Promise<null | Response> {
  const action = getRouteAction(request.method, url.pathname);
  if (!action) {
    return null;
  }

  const authError = await requireAdminCapability(request, config, "world.manage");
  if (authError) {
    return authError;
  }

  try {
    if (action === "get-calibration") {
      return handleGetCalibration();
    }
    if (action === "start-calibrate") {
      return await handleStartCalibrate(request, config);
    }
    if (action === "get-latest") {
      return handleGetLatestStatus();
    }
    if (action === "get-job") {
      return handleGetJobStatus(url);
    }
    if (action === "get-pair") {
      return await handleGetPairDemand(url, config);
    }
    return jsonResponse({ error: "Method not allowed" }, { status: 405 });
  } catch (error) {
    if (error instanceof BackendHttpError) {
      return jsonResponse(error.toNormalizedJson(), { status: error.status });
    }
    return jsonResponse({ error: "Calibration request failed" }, { status: 500 });
  }
}

export function handleGetCalibration(): Response {
  return jsonResponse(loadCalibration());
}

export function handleGetJobStatus(url: URL): Response {
  const jobId = url.pathname.slice("/admin/demand/calibrate/jobs/".length);
  const job = getCalibrationJobStatus(jobId);
  if (!job) {
    return jsonResponse(
      { error: { code: "CALIBRATION_JOB_NOT_FOUND", message: "Calibration job not found." } },
      { status: 404 },
    );
  }
  return jsonResponse({ job });
}

export function handleGetLatestStatus(): Response {
  const job = getLatestCalibrationJobStatus();
  if (!job) {
    return jsonResponse(
      { error: { code: "CALIBRATION_JOB_NOT_FOUND", message: "No calibration job found." } },
      { status: 404 },
    );
  }
  return jsonResponse({ job });
}

// GET /admin/demand/pair?origin=FRA&destination=JFK — runs the live demand model for
// one airport pair and returns the full factor breakdown, so an operator can inspect
// exactly how a number was produced (which factor pulled it up/down). Read-only.
export async function handleGetPairDemand(url: URL, config: BffConfig): Promise<Response> {
  const origin = url.searchParams.get("origin")?.trim().toUpperCase();
  const destination = url.searchParams.get("destination")?.trim().toUpperCase();
  if (!origin || !destination || origin === destination) {
    return jsonResponse({ error: "origin and destination IATA codes are required and must differ" }, { status: 400 });
  }

  const resolved = await resolvePairAirports(config, origin, destination);
  if ("error" in resolved) {
    return jsonResponse({ error: resolved.error }, { status: resolved.status });
  }

  const { destinationAirport, destinationRegion, distance, originAirport, originRegion } = resolved;
  const demand = computeAirportPairDemand(originAirport, destinationAirport, originRegion, destinationRegion, distance);
  return jsonResponse({
    breakdown: demand.breakdown,
    destinationDailyPassengers: demand.destinationDailyPassengers,
    destinationIata: destination,
    destinationName: destinationAirport.intl_name ?? destination,
    distanceKm: Math.round(distance),
    originDailyPassengers: demand.originDailyPassengers,
    originIata: origin,
    originName: originAirport.intl_name ?? origin,
  });
}

export async function handleStartCalibrate(
  request: Request,
  config: BffConfig,
): Promise<Response> {
  const body = (await request.json().catch(() => ({}))) as { refresh?: boolean };
  const job = startCalibrationJob(config, Boolean(body.refresh), adminActorId(request));
  return jsonResponse(
    {
      jobId: job.id,
      status: job.status,
      statusUrl: `/admin/demand/calibrate/jobs/${job.id}`,
    },
    { status: 202 },
  );
}

function pairDistanceKm(origin: PairAirport, destination: PairAirport): number {
  const a = parseGeoPoint(origin.geog, origin.geom);
  const b = parseGeoPoint(destination.geog, destination.geom);
  return a && b ? Math.max(50, distanceKm(a.latitude, a.longitude, b.latitude, b.longitude)) : 1500;
}

// Loads backend airports/regions and resolves the pair (by IATA) plus its distance.
// Returns an error shape the caller turns into the right HTTP status.
async function resolvePairAirports(
  config: BffConfig,
  origin: string,
  destination: string,
): Promise<
  | { destinationAirport: PairAirport; destinationRegion?: DemandRegionInput; distance: number; originAirport: PairAirport; originRegion?: DemandRegionInput }
  | { error: string; status: number }
> {
  const token = await getBackendAdminToken(config);
  const [airportsRes, regionsRes] = await Promise.all([
    backendRequest<{ airports?: PairAirport[] }>(config, "/airports", { token }),
    backendRequest<{ regions?: DemandRegionInput[] }>(config, "/regions", { token }),
  ]);
  const airports = airportsRes.airports ?? [];
  const originAirport = airports.find((a) => a.iata_code?.toUpperCase() === origin);
  const destinationAirport = airports.find((a) => a.iata_code?.toUpperCase() === destination);
  if (!originAirport || !destinationAirport) {
    return { error: `Airport not found: ${originAirport ? destination : origin}`, status: 404 };
  }

  const regionById = new Map((regionsRes.regions ?? []).filter((r) => r.id).map((r) => [r.id ?? "", r] as const));
  return {
    destinationAirport,
    destinationRegion: destinationAirport.region_id ? regionById.get(destinationAirport.region_id) : undefined,
    distance: pairDistanceKm(originAirport, destinationAirport),
    originAirport,
    originRegion: originAirport.region_id ? regionById.get(originAirport.region_id) : undefined,
  };
}
