import type { BffConfig } from "../../config";

import { getBackendAdminToken } from "../../auth";
import { recordAdminAudit } from "../admin/audit";
import { backendRequest } from "../import/backend/api";
import {
  type CalibrationRunResult,
  runCalibration,
  type RunnerAirport,
  type RunnerRegion,
} from "./calibration-runner";

export type CalibrationJobStatus = {
  error?: string;
  finishedAt?: string;
  id: string;
  logs: CalibrationLogEntry[];
  progress: CalibrationProgress;
  result?: CalibrationRunResult;
  startedAt: string;
  status: "failed" | "queued" | "running" | "succeeded";
};

export type CalibrationLogEntry = CalibrationLogInput & {
  timestamp: string;
};

export type CalibrationLogger = (input: CalibrationLogInput) => void;

export type CalibrationLogInput = {
  details?: unknown;
  entityType?: string;
  level: "error" | "info" | "warning";
  message: string;
  operation: string;
  sourceKey?: string;
  stage: "fetching" | "finalizing" | "fitting" | "preparing";
};

export type CalibrationProgress = {
  message: string;
  percent: number;
  stage: "fetching" | "finalizing" | "fitting" | "preparing";
};

export type LoadMetaResult = {
  airports: RunnerAirport[];
  regions: RunnerRegion[];
};

const calibrationJobs = new Map<string, CalibrationJobStatus>();

export async function auditJob(job: CalibrationJobStatus, actorId: string): Promise<void> {
  try {
    await recordAdminAudit({
      action: "calibration.run",
      capability: "world.manage",
      entity_type: "demand-calibration",
      success: job.status === "succeeded",
      user_id: actorId,
    });
  } catch (error) {
    console.warn("Calibration admin audit write failed:", error);
  }
}

export function createCalibrationLogger(job: CalibrationJobStatus): CalibrationLogger {
  return (input) => {
    const entry: CalibrationLogEntry = { ...input, timestamp: new Date().toISOString() };
    job.logs.push(entry);
    if (job.logs.length > 250) {
      job.logs.splice(0, job.logs.length - 250);
    }
    const context = { calibrationJobId: job.id, ...entry };
    if (entry.level === "error") {
      console.error("Demand calibration", context);
    } else if (entry.level === "warning") {
      console.warn("Demand calibration", context);
    } else {
      // eslint-disable-next-line no-console
      console.log("Demand calibration", context);
    }
  };
}

export function getCalibrationJobStatus(jobId: string): CalibrationJobStatus | null {
  return calibrationJobs.get(jobId) ?? null;
}

export function getLatestCalibrationJobStatus(): CalibrationJobStatus | null {
  return Array.from(calibrationJobs.values()).at(-1) ?? null;
}

export function handleJobError(job: CalibrationJobStatus, error: unknown, log: CalibrationLogger): void {
  const message = error instanceof Error ? error.message : "Calibration job failed";
  log({
    level: "error",
    message,
    operation: "job.failed",
    stage: job.progress.stage,
  });
  Object.assign(job, {
    error: message,
    finishedAt: new Date().toISOString(),
    status: "failed",
  });
  const j = job;
  j.progress = { ...j.progress, message };
}

export async function loadCalibrationMetadata(config: BffConfig): Promise<LoadMetaResult> {
  const token = await getBackendAdminToken(config);
  const [airportsRes, regionsRes] = await Promise.all([
    backendRequest<{ airports?: RunnerAirport[] }>(config, "/airports", { token }),
    backendRequest<{ regions?: RunnerRegion[] }>(config, "/regions", { token }),
  ]);
  return {
    airports: airportsRes.airports ?? [],
    regions: regionsRes.regions ?? [],
  };
}

export async function runCalibrationJob(
  config: BffConfig,
  refresh: boolean,
  job: CalibrationJobStatus,
  actorId: string,
): Promise<void> {
  const log = createCalibrationLogger(job);
  Object.assign(job, { status: "running" });
  log({ level: "info", message: "Calibration job started", operation: "job.start", stage: "preparing" });
  job.progress = { message: "Loading airports and regions from backend", percent: 10, stage: "preparing" };

  try {
    const { airports, regions } = await loadCalibrationMetadata(config);
    
    const activeJob = calibrationJobs.get(job.id);
    if (activeJob) {
      activeJob.progress = { message: "Fetching or loading anchors", percent: 30, stage: "fetching" };
    }

    log({
      level: "info",
      message: `Loaded ${String(airports.length)} airports and ${String(regions.length)} regions from backend`,
      operation: "job.load_meta",
      stage: "fetching",
    });

    const result = await runCalibration({
      airports,
      log,
      refresh,
      regions,
      updateProgress: (message, percent, stage) => {
        const currentJob = calibrationJobs.get(job.id);
        if (currentJob) {
          currentJob.progress = { message, percent, stage };
        }
      },
    });

    const finalJob = calibrationJobs.get(job.id);
    if (finalJob) {
      Object.assign(finalJob, {
        finishedAt: new Date().toISOString(),
        result,
        status: "succeeded",
      });
      finalJob.progress = { message: "Calibration succeeded", percent: 100, stage: "finalizing" };
    }
    log({ level: "info", message: "Calibration completed successfully", operation: "job.success", stage: "finalizing" });
  } catch (error) {
    const errorJob = calibrationJobs.get(job.id);
    if (errorJob) {
      handleJobError(errorJob, error, log);
    }
  } finally {
    const finalJob = calibrationJobs.get(job.id);
    if (finalJob) {
      await auditJob(finalJob, actorId);
    }
  }
}

export function startCalibrationJob(
  config: BffConfig,
  refresh: boolean,
  actorId = "authenticated-user",
): CalibrationJobStatus {
  const activeJob = Array.from(calibrationJobs.values()).find(
    (job) => job.status === "queued" || job.status === "running",
  );
  if (activeJob) {
    return activeJob;
  }

  const job: CalibrationJobStatus = {
    id: crypto.randomUUID(),
    logs: [],
    progress: { message: "Calibration job queued", percent: 0, stage: "preparing" },
    startedAt: new Date().toISOString(),
    status: "queued",
  };

  calibrationJobs.set(job.id, job);
  void runCalibrationJob(config, refresh, job, actorId);

  return job;
}
