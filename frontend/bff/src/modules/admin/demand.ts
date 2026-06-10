import type { BffConfig } from "../../config";

import { requireAdminCapability } from "../../auth";
import { BackendHttpError } from "../../backend-http";
import { jsonResponse } from "../../http";
import { loadCalibration } from "../demand/calibration";
import {
  getCalibrationJobStatus,
  getLatestCalibrationJobStatus,
  startCalibrationJob,
} from "../demand/calibration-jobs";
import { adminActorId } from "./audit";

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
