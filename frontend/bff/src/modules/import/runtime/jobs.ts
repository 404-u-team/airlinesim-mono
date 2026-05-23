import type { BffConfig } from "../../../config";
import type { ImportMode, ImportReport } from "../shared/types";

import { runWorldDataImport, type ImportOptions } from "./pipeline";

export type ImportJobStatus = {
  error?: string;
  finishedAt?: string;
  id: string;
  mode: ImportMode;
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

export function getImportJobStatus(jobId: string): ImportJobStatus | null {
  return jobs.get(jobId) ?? null;
}

export function startWorldDataImportJob(config: BffConfig, options: ImportOptions): ImportJobStatus {
  const job: ImportJobStatus = {
    id: crypto.randomUUID(),
    mode: options.mode,
    startedAt: new Date().toISOString(),
    status: "queued",
  };

  jobs.set(job.id, job);
  void runJob(config, options, job);

  return job;
}

async function runJob(config: BffConfig, options: ImportOptions, job: ImportJobStatus): Promise<void> {
  job.status = "running";

  try {
    const result = await runWorldDataImport(config, options);
    job.finishedAt = new Date().toISOString();
    job.report = summarizeReport(result.report);
    job.status = result.report.errors.length > 0 ? "failed" : "succeeded";
  } catch (error) {
    job.error = error instanceof Error ? error.message : "World-data import job failed";
    job.finishedAt = new Date().toISOString();
    job.status = "failed";
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
