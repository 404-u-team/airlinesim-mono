import type { BffConfig } from "../../config";
import type { ImportMode, ImportRequestBody } from "./shared/types";

import { jsonResponse } from "../../http";
import { getImportJobStatus, startWorldDataImportJob } from "./runtime/jobs";

export async function handleImportRequest(
  request: Request,
  url: URL,
  config: BffConfig,
): Promise<null | Response> {
  if (request.method === "POST" && url.pathname === "/import/world-data") {
    return importWorldData(request, url, config);
  }

  if (request.method === "POST" && url.pathname === "/import/world-data/dry-run") {
    return importWorldData(request, url, config, "dry-run");
  }

  if (request.method === "POST" && url.pathname === "/import/world-data/run") {
    return importWorldData(request, url, config, "import");
  }

  if (request.method === "GET" && url.pathname === "/import/world-data/status") {
    return getImportStatus(url);
  }

  if (request.method === "GET" && url.pathname.startsWith("/import/world-data/jobs/")) {
    return getImportStatus(url);
  }

  return null;
}

function getImportStatus(url: URL): Response {
  const jobId = url.pathname.startsWith("/import/world-data/jobs/")
    ? url.pathname.slice("/import/world-data/jobs/".length)
    : url.searchParams.get("jobId");
  const job = jobId ? getImportJobStatus(jobId) : null;

  if (!job) {
    return jsonResponse({ error: "Import job not found" }, { status: 404 });
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
    dataDir: body.dataDir,
    mode,
    refreshRaw: body.refreshRaw,
    source: body.source,
  });

  return jsonResponse({
    jobId: job.id,
    status: job.status,
    statusUrl: `/import/world-data/jobs/${job.id}`,
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
