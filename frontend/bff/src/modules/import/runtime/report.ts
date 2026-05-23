import type { ImportMode, ImportReport, ReportItem } from "../shared/types";

export function createReport(mode: ImportMode): ImportReport {
  return {
    counts: {
      airportsToCreate: 0,
      conflicts: 0,
      countries: 0,
      countriesSkipped: 0,
      countriesToCreate: 0,
      errors: 0,
      invalidSkipped: 0,
      rawAirports: 0,
      regionLinks: 0,
      regionLinksToCreate: 0,
      regions: 0,
      regionsToCreate: 0,
      selectedAirports: 0,
      skippedAirports: 0,
      updatesNeeded: 0,
      warnings: 0,
    },
    errors: [],
    finishedAt: "",
    mode,
    quality: {
      airportsUsingUtcFallback: 0,
      countriesUsingTaxFallback: 0,
      countriesWithoutTailCode: 0,
      regionsUsingAirportPopulationFallback: 0,
    },
    skipped: [],
    startedAt: new Date().toISOString(),
    warnings: [],
  };
}

export function finishReport(report: ImportReport): ImportReport {
  report.finishedAt = new Date().toISOString();
  report.counts.errors = report.errors.length;
  report.counts.invalidSkipped = report.skipped.length;
  report.counts.warnings = report.warnings.length;

  return report;
}

export function pushError(report: ImportReport, item: ReportItem): void {
  report.errors.push(item);
}

export function pushSkip(report: ImportReport, item: ReportItem): void {
  report.skipped.push(item);
}

export function pushWarning(report: ImportReport, item: ReportItem): void {
  report.warnings.push(item);
}
