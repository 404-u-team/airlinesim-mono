import type { FitQuality } from "./calibration-fit";

import { readDocument, writeDocument } from "../../db/database";
import { type CalibrationParams, DEFAULT_CALIBRATION } from "./model";

// Versioned calibration artifact (Layer 2). Produced by the admin calibration
// button (Phase 3) which fits `params` and per-country `propensity` against real
// Eurostat/BTS anchors. Until calibration has run, defaults apply and every
// country's propensity is the neutral 1.0. See docs/passenger-demand-model.md.

export type CalibrationArtifact = {
  fittedAt?: string;
  params: CalibrationParams;
  // country sourceKey/id → aviation-propensity multiplier
  propensityByCountry: Record<string, number>;
  // fit quality metrics for transparency in the admin UI
  quality?: Partial<FitQuality>;
  version: number;
};

const CALIBRATION_DOC = "demand-calibration";

const DEFAULT_ARTIFACT: CalibrationArtifact = {
  params: DEFAULT_CALIBRATION,
  propensityByCountry: {},
  version: 0,
};

export function getCalibrationParams(): CalibrationParams {
  return loadCalibration().params;
}

export function getCountryPropensity(countryId: string | undefined, artifact = loadCalibration()): number {
  if (!countryId) {
    return 1;
  }
  return artifact.propensityByCountry[countryId] ?? 1;
}

export function loadCalibration(): CalibrationArtifact {
  return readDocument<CalibrationArtifact>(CALIBRATION_DOC, DEFAULT_ARTIFACT);
}

export function saveCalibration(artifact: CalibrationArtifact): void {
  writeDocument(CALIBRATION_DOC, artifact);
}
