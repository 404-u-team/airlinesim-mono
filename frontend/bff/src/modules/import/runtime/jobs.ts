import type { BffConfig } from "../../../config";
import type { ImportMode, ImportReport } from "../shared/types";

import type { ImportProgress } from "./progress";
import { runWorldDataImport, type ImportOptions } from "./pipeline";
import { errorDetails, type ImportLogEntry, type ImportLogInput } from "./logger";
import { recordAdminAudit } from "../../admin/audit";
import { cache } from "../../proxy";

export type ImportJobStatus = {
  error?: string;
  finishedAt?: string;
  id: string;
  logs: ImportLogEntry[];
  mode: ImportMode;
  progress: ImportProgress;
  report?: ImportJobReportSummary;
  startedAt: string;
  status: "failed" | "queued" | "running" | "succeeded";
};

type ImportJobReportSummary = {
  counts: Record<string, number>;
  errors: number;
  firstErrors: Array<{ entityType: string; message: string; sourceKey: string }>;
  firstWarnings: Array<{ entityType: string; message: string; sourceKey: string }>;
  quality: Record<string, number>;
  reportPath?: string;
  warnings: number;
};

const jobs = new Map<string, ImportJobStatus>();
const listeners = new Set<(job: ImportJobStatus) => void>();
const MAX_JOB_LOGS = 250;

export function getImportJobStatus(jobId: string): ImportJobStatus | null {
  return jobs.get(jobId) ?? null;
}

export function getLatestImportJobStatus(): ImportJobStatus | null {
  return Array.from(jobs.values()).at(-1) ?? null;
}

export function subscribeToImportJobs(listener: (job: ImportJobStatus) => void): () => void {
  listeners.add(listener);

  return () => listeners.delete(listener);
}

export function startWorldDataImportJob(config: BffConfig, options: ImportOptions, actorId = "authenticated-user"): ImportJobStatus {
  const activeJob = Array.from(jobs.values()).find((job) => job.status === "queued" || job.status === "running");
  if (activeJob) {
    return activeJob;
  }

  const job: ImportJobStatus = {
    id: crypto.randomUUID(),
    logs: [],
    mode: options.mode,
    progress: { message: "Import job queued", percent: 0, stage: "preparing" },
    startedAt: new Date().toISOString(),
    status: "queued",
  };

  jobs.set(job.id, job);
  publishJob(job);
  void runJob(config, options, job, actorId);

  return job;
}

async function runJob(config: BffConfig, options: ImportOptions, job: ImportJobStatus, actorId: string): Promise<void> {
  const log = createJobLogger(job);
  Object.assign(job, { status: "running" });
  log({ level: "info", message: "Import job started", operation: "job.start", stage: "preparing" });
  publishJob(job);

  try {
    let lastPublishedAt = 0;
    const result = await runWorldDataImport(config, options, (progress) => {
      const stageChanged = progress.stage !== job.progress.stage;
      job.progress = progress;
      if (stageChanged || progress.percent >= 98 || Date.now() - lastPublishedAt >= 100) {
        lastPublishedAt = Date.now();
        publishJob(job);
      }
    }, log);
    Object.assign(job, {
      finishedAt: new Date().toISOString(),
      report: summarizeReport(result.report),
      status: result.report.errors.length > 0 ? "failed" : "succeeded",
    });
    if (job.status === "succeeded" && job.mode === "import") {
      cache.clear();
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "World-data import job failed";
    log({
      details: errorDetails(error),
      level: "error",
      message,
      operation: "job.failed",
      stage: job.progress.stage,
    });
    Object.assign(job, {
      error: message,
      finishedAt: new Date().toISOString(),
      progress: { ...job.progress, message },
      status: "failed",
    });
  } finally {
    publishJob(job);
    try {
      await recordAdminAudit({
        action: job.mode === "dry-run" ? "import.dry-run" : "import.run",
        capability: "world.manage",
        entity_type: "world-data",
        import_job_id: job.id,
        success: job.status === "succeeded",
        user_id: actorId,
      });
    } catch (error) {
      console.warn("Import admin audit write failed:", error);
    }
  }
}

function createJobLogger(job: ImportJobStatus): (input: ImportLogInput) => void {
  let lastPublishedAt = 0;

  return (input) => {
    const entry: ImportLogEntry = { ...input, timestamp: new Date().toISOString() };
    job.logs.push(entry);
    if (job.logs.length > MAX_JOB_LOGS) {
      job.logs.splice(0, job.logs.length - MAX_JOB_LOGS);
    }
    const context = { importJobId: job.id, ...entry };
    if (entry.level === "error") {
      console.error("World-data import", context);
    } else if (entry.level === "warning") {
      console.warn("World-data import", context);
    } else {
      console.warn("World-data import", context);
    }
    if (entry.level !== "info" || Date.now() - lastPublishedAt >= 250) {
      lastPublishedAt = Date.now();
      publishJob(job);
    }
  };
}

function publishJob(job: ImportJobStatus): void {
  for (const listener of listeners) {
    listener(job);
  }
}

function summarizeReport(report: ImportReport): ImportJobReportSummary {
  return {
    counts: report.counts,
    errors: report.errors.length,
    firstErrors: report.errors.slice(0, 10),
    firstWarnings: report.warnings.slice(0, 10),
    quality: report.quality,
    reportPath: report.reportPath,
    warnings: report.warnings.length,
  };
}
