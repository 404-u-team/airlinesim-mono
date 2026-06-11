import type { BffConfig } from "../../config";
import type { ImportMode, ImportRequestBody } from "./shared/types";

import { requireAdminCapability } from "../../auth";
import { jsonResponse } from "../../http";
import { adminActorId } from "../admin/audit";
import { getImportJobStatus, getLatestImportJobStatus, startAircraftImagesJob, startWorldDataImportJob } from "./runtime/jobs";

export async function handleImportRequest(
  request: Request,
  url: URL,
  config: BffConfig,
): Promise<null | Response> {
  const path = url.pathname.replace(/^\/admin/, "");
  if (!path.startsWith("/import/world-data") && path !== "/import/aircraft-images") {
    return null;
  }

  const authError = await requireAdminCapability(request, config, "world.manage");
  if (authError) {
    return authError;
  }

  if (request.method === "POST" && path === "/import/aircraft-images") {
    return importAircraftImages(request, config);
  }

  if (request.method === "POST" && path === "/import/world-data") {
    return importWorldData(request, url, config);
  }

  if (request.method === "POST" && path === "/import/world-data/dry-run") {
    return importWorldData(request, url, config, "dry-run");
  }

  if (request.method === "POST" && path === "/import/world-data/run") {
    return importWorldData(request, url, config, "import");
  }

  if (request.method === "GET" && path === "/import/world-data/status") {
    return getImportStatus(url, path);
  }

  if (request.method === "GET" && path.startsWith("/import/world-data/jobs/")) {
    return getImportStatus(url, path);
  }

  return null;
}

function getImportStatus(url: URL, path: string): Response {
  const jobId = path.startsWith("/import/world-data/jobs/")
    ? path.slice("/import/world-data/jobs/".length)
    : url.searchParams.get("jobId");
  const job = jobId ? getImportJobStatus(jobId) : getLatestImportJobStatus();

  if (!job) {
    return jsonResponse({ error: { code: "IMPORT_JOB_NOT_FOUND", message: "Import job not found.", retryable: false } }, { status: 404 });
  }

  return jsonResponse({ job });
}

async function importWorldData(
  request: Request,
  url: URL,
  config: BffConfig,
  routeMode?: ImportMode,
): Promise<Response> {
  const body = await readOptionalJson(request);
  const mode = routeMode ?? normalizeMode(url.searchParams.get("mode") ?? body.mode);
  const job = startWorldDataImportJob(config, {
    mode,
    refreshRaw: body.refreshRaw,
    source: body.source,
  }, adminActorId(request));

  return jsonResponse({
    jobId: job.id,
    status: job.status,
    statusUrl: `/admin/import/world-data/jobs/${job.id}`,
  }, { status: 202 });
}

async function importAircraftImages(
  request: Request,
  config: BffConfig,
): Promise<Response> {
  const body = await readOptionalJson(request);
  const job = startAircraftImagesJob(config, { refresh: body.refreshRaw === true }, adminActorId(request));

  return jsonResponse({
    jobId: job.id,
    status: job.status,
    statusUrl: `/admin/import/world-data/jobs/${job.id}`,
  }, { status: 202 });
}

async function readOptionalJson(request: Request): Promise<ImportRequestBody> {
  const text = await request.text();

  if (!text.trim()) {
    return {};
  }

  return JSON.parse(text) as ImportRequestBody;
}

function normalizeMode(value: null | string | undefined): ImportMode {
  return value === "import" ? "import" : "dry-run";
}
