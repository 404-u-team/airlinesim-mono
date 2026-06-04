import type { ImportReport } from "../shared/types";

export type ImportProgress = {
  counts?: Record<string, number>;
  current?: number;
  entityType?: string;
  message: string;
  percent: number;
  stage: "building" | "finalizing" | "importing" | "preparing" | "reconciling" | "validating";
  total?: number;
};

export type ImportProgressReporter = (progress: ImportProgress) => void;

export function progressCounts(report: ImportReport): Record<string, number> {
  return {
    ...report.counts,
    errors: report.errors.length,
    invalidSkipped: report.skipped.length,
    warnings: report.warnings.length,
  };
}
