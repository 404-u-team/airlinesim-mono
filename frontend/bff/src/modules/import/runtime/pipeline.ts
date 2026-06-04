import type { BffConfig } from "../../../config";
import type { ImportMode, ImportReport, ImportResult, SourceIssueSink, WorldData } from "../shared/types";

import { planOrImport } from "./importExecutor";
import { buildWorldData } from "../build";
import { finishReport, pushError, pushSkip, pushWarning, createReport } from "./report";
import { ensureImportDirs, getImportPaths, writeJsonFile, writeMappings, writeReport } from "./storage";
import { progressCounts, type ImportProgressReporter } from "./progress";
import type { ImportLogger } from "./logger";
import { prepareReconcileState, reconcileExistingBackend } from "./reconcile";
import { validateWorldData } from "../validation/worldData";

export type ImportOptions = {
  dataDir?: string;
  mode: ImportMode;
  refreshRaw?: boolean;
  source?: "cache" | "fetch";
};

export async function runWorldDataImport(
  config: BffConfig,
  options: ImportOptions,
  reportProgress?: ImportProgressReporter,
  log?: ImportLogger,
): Promise<ImportResult> {
  log?.({ level: "info", message: "Preparing import workspace", operation: "workspace.prepare", stage: "preparing" });
  reportProgress?.({ message: "Preparing import workspace", percent: 2, stage: "preparing" });
  const paths = getImportPaths(options.dataDir);
  await ensureImportDirs(paths);

  const report = createReport(options.mode);
  const issues = createIssueSink(report, log);
  reportProgress?.({ message: "Loading sources and building world data", percent: 8, stage: "building" });
  const data = await buildWorldData(options, issues, log);
  fillBuildCounts(report, data);
  reportProgress?.({ counts: progressCounts(report), message: "World data built", percent: 32, stage: "building" });
  reportProgress?.({ counts: progressCounts(report), message: "Validating world data", percent: 36, stage: "validating" });
  validateWorldData(data, issues);
  await writeJsonFile(`${paths.stageDir}/world-data.latest.json`, data);

  reportProgress?.({ counts: progressCounts(report), message: "Preparing backend reconciliation", percent: 44, stage: "reconciling" });
  const state = await prepareReconcileState(config, options.mode, paths.mappingPath, report);
  await reconcileExistingBackend(config, state, data, log);
  reportProgress?.({ counts: progressCounts(report), message: "Backend reconciliation completed", percent: 54, stage: "reconciling" });
  await planOrImport(config, state, data, report, options.mode, reportProgress, log);

  reportProgress?.({ counts: progressCounts(report), message: "Writing import report", percent: 98, stage: "finalizing" });
  finishReport(report);
  await writeReport(paths, report);

  if (options.mode === "import") {
    await writeMappings(paths.mappingPath, state.mappings);
  }

  reportProgress?.({ counts: progressCounts(report), message: "Import job completed", percent: 100, stage: "finalizing" });
  log?.({ level: "info", message: "Import job completed", operation: "job.complete", stage: "finalizing" });
  return { data, report };
}

function createIssueSink(report: ImportReport, log?: ImportLogger): SourceIssueSink {
  return {
    error(entityType, sourceKey, message) {
      pushError(report, { entityType, message, sourceKey });
      log?.({ entityType, level: "error", message, operation: "validation.issue", sourceKey, stage: "validating" });
    },
    reportQuality(key) {
      report.quality[key] = (report.quality[key] ?? 0) + 1;
    },
    skip(entityType, sourceKey, message) {
      pushSkip(report, { entityType, message, sourceKey });
      log?.({ entityType, level: "warning", message, operation: "entity.skip", sourceKey, stage: "building" });
    },
    warn(entityType, sourceKey, message) {
      pushWarning(report, { entityType, message, sourceKey });
      log?.({ entityType, level: "warning", message, operation: "validation.warning", sourceKey, stage: "validating" });
    },
  };
}

function fillBuildCounts(report: ImportReport, data: WorldData): void {
  report.counts.aircraftTypes = data.aircraftTypes.length;
  report.counts.countries = data.countries.length;
  report.counts.regions = data.regions.length;
  report.counts.selectedAirports = data.airports.length;
  report.counts.regionLinks = data.regionLinks.length;
  report.counts.skippedAirports = report.skipped.filter((item) => item.entityType === "airport").length;
  report.counts.rawAirports = report.counts.selectedAirports + report.counts.skippedAirports;
}
