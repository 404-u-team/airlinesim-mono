import { parseGeoPoint } from "../../geo";
import { distanceKm } from "../import/shared/math";
import { type AnchorStore, getCalibrationAnchors } from "./anchors";
import { type CalibrationArtifact, loadCalibration, saveCalibration } from "./calibration";
import { type CalibrationAnchor, fitCalibration } from "./calibration-fit";
import { DEFAULT_CALIBRATION, explainPairDemand, type MarketEndpoint } from "./model";
import { getAirportProfile } from "./profiles";

// Calibration runner (Layer 2). Resolves each real anchor pair to the model's
// *structural* prediction (baseScale = 1, propensity = 1), fits baseScale + per-
// country propensity to the observed traffic, saves the versioned artifact, and
// returns a scorecard (model vs real) for transparency. See
// docs/passenger-demand-model.md "Калибровка".

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

export type CalibrationRunResult = {
  anchorsTotal: number;
  anchorsUsed: number;
  artifact: CalibrationArtifact;
  scorecard: ScorecardRow[];
};

export type RunnerAirport = {
  geog?: string;
  geom?: string;
  iata_code?: string;
  icao_code?: string;
  region_id?: string;
};

export type RunnerAnchorRecord = {
  dailyPax: number;
  destIata: string;
  originIata: string;
};

export type RunnerRegion = {
  business_score?: number;
  country_id?: string;
  gdp_per_capita?: number;
  id?: string;
  population?: number;
  tourism_score?: number;
};

export type ScorecardRow = {
  destIata: string;
  errorPct: number;
  modelDailyPax: number;
  originIata: string;
  realDailyPax: number;
};

// Structural calibration: model with baseScale neutralised to 1.
const STRUCTURAL_CALIBRATION = { ...DEFAULT_CALIBRATION, baseScale: 1 };

export function airportShare(icaoCode: string | undefined): number {
  return getAirportProfile(icaoCode)?.capacityShare ?? 1;
}

export function buildAirportMap(airports: RunnerAirport[]): {
  airportByIata: Map<string, RunnerAirport>;
  icaoToIata: Map<string, string>;
} {
  const airportByIata = new Map<string, RunnerAirport>();
  const icaoToIata = new Map<string, string>();
  for (const airport of airports) {
    const iata = airport.iata_code?.toUpperCase();
    if (iata) {
      airportByIata.set(iata, airport);
      if (airport.icao_code) {
        icaoToIata.set(airport.icao_code.toUpperCase(), iata);
      }
    }
  }
  return { airportByIata, icaoToIata };
}

export function buildScorecard(
  anchors: CalibrationAnchor[],
  baseScale: number,
  propensity: Record<string, number>,
): ScorecardRow[] {
  return anchors
    .map((anchor) => {
      const factor = Math.sqrt((propensity[anchor.originCountry] ?? 1) * (propensity[anchor.destCountry] ?? 1));
      const modelDailyPax = Math.round(baseScale * factor * anchor.structural);
      const errorPct = Math.round(((modelDailyPax - anchor.dailyPax) / anchor.dailyPax) * 100);
      return {
        destIata: anchor.destIata,
        errorPct,
        modelDailyPax,
        originIata: anchor.originIata,
        realDailyPax: anchor.dailyPax,
      };
    })
    .sort((a, b) => Math.abs(b.errorPct) - Math.abs(a.errorPct));
}

export function endpointFor(airport: RunnerAirport, region: RunnerRegion | undefined): MarketEndpoint {
  const profile = getAirportProfile(airport.icao_code);
  const marketCatchment = profile?.marketCatchmentPopulation ?? 0;

  return {
    businessScore: region?.business_score,
    catchmentPopulation: marketCatchment > 0 ? marketCatchment : region?.population ?? 0,
    countryId: region?.country_id,
    gdpPerCapita: region?.gdp_per_capita,
    propensity: 1,
    tourismScore: region?.tourism_score,
  };
}

export function executeFitAndLog(
  fitAnchors: CalibrationAnchor[],
  log?: CalibrationLogger,
  updateProgress?: (
    message: string,
    percent: number,
    stage: "fetching" | "finalizing" | "fitting" | "preparing",
  ) => void,
): ReturnType<typeof fitCalibration> {
  updateProgress?.(`Fitting ${String(fitAnchors.length)} usable anchor pairs`, 80, "fitting");
  log?.({
    level: "info",
    message: `Fitting ${String(fitAnchors.length)} usable anchor pairs using alternating least squares`,
    operation: "runner.fit",
    stage: "fitting",
  });
  return fitCalibration(fitAnchors);
}

export async function fetchAnchorsAndLog(
  icaoToIata: Map<string, string>,
  log?: CalibrationLogger,
  refresh?: boolean,
): Promise<AnchorStore> {
  log?.({
    level: "info",
    message: "Loading calibration anchors...",
    operation: "runner.load_anchors",
    stage: "fetching",
  });
  return getCalibrationAnchors({ icaoToIata, log, refresh });
}

export function pairDistance(origin: RunnerAirport, destination: RunnerAirport): number {
  const a = parseGeoPoint(origin.geog, origin.geom);
  const b = parseGeoPoint(destination.geog, destination.geom);
  if (!a || !b) {
    return 1500;
  }
  return Math.max(50, distanceKm(a.latitude, a.longitude, b.latitude, b.longitude));
}

export function resolveAnchors(
  records: RunnerAnchorRecord[],
  airportByIata: Map<string, RunnerAirport>,
  regionById: Map<string, RunnerRegion>,
): CalibrationAnchor[] {
  const fitAnchors: CalibrationAnchor[] = [];
  for (const record of records) {
    const resolved = resolveStructural(record.originIata, record.destIata, airportByIata, regionById);
    if (resolved && resolved.structural > 0) {
      fitAnchors.push({
        dailyPax: record.dailyPax,
        destCountry: resolved.destCountry,
        destIata: record.destIata.toUpperCase(),
        originCountry: resolved.originCountry,
        originIata: record.originIata.toUpperCase(),
        structural: resolved.structural,
      });
    }
  }
  return fitAnchors;
}

export function resolveStructural(
  originIata: string,
  destIata: string,
  airportByIata: Map<string, RunnerAirport>,
  regionById: Map<string, RunnerRegion>,
): null | { destCountry: string; originCountry: string; structural: number } {
  const origin = airportByIata.get(originIata.toUpperCase());
  const destination = airportByIata.get(destIata.toUpperCase());
  if (!origin || !destination) {
    return null;
  }
  const originRegion = origin.region_id ? regionById.get(origin.region_id) : undefined;
  const destRegion = destination.region_id ? regionById.get(destination.region_id) : undefined;
  const originCountry = originRegion?.country_id;
  const destCountry = destRegion?.country_id;
  if (!originCountry || !destCountry) {
    return null;
  }

  const { result } = explainPairDemand(
    endpointFor(origin, originRegion),
    endpointFor(destination, destRegion),
    pairDistance(origin, destination),
    {},
    STRUCTURAL_CALIBRATION,
  );

  const shareFactor = airportShare(origin.icao_code) * airportShare(destination.icao_code);
  const structural = ((result.originToDestination + result.destinationToOrigin) / 2) * shareFactor;

  return { destCountry, originCountry, structural };
}

export async function runCalibration(input: {
  airports: RunnerAirport[];
  log?: CalibrationLogger;
  refresh?: boolean;
  regions: RunnerRegion[];
  updateProgress?: (
    message: string,
    percent: number,
    stage: "fetching" | "finalizing" | "fitting" | "preparing",
  ) => void;
}): Promise<CalibrationRunResult> {
  const { airportByIata, icaoToIata } = buildAirportMap(input.airports);
  const regionById = new Map(input.regions.filter((r) => r.id).map((r) => [r.id ?? "", r] as const));

  const anchorStore = await fetchAnchorsAndLog(icaoToIata, input.log, input.refresh);

  input.updateProgress?.("Resolving anchor pairs to structural demand", 60, "fitting");
  input.log?.({
    level: "info",
    message: `Loaded ${String(anchorStore.records.length)} anchors. Resolving structural demand for pairs...`,
    operation: "runner.resolve_structural",
    stage: "fitting",
  });

  const fitAnchors = resolveAnchors(anchorStore.records, airportByIata, regionById);
  const fit = executeFitAndLog(fitAnchors, input.log, input.updateProgress);
  const artifact = saveFitArtifact(fit, input.log, input.updateProgress);

  return {
    anchorsTotal: anchorStore.records.length,
    anchorsUsed: fitAnchors.length,
    artifact,
    scorecard: buildScorecard(fitAnchors, fit.baseScale, fit.propensityByCountry),
  };
}

export function saveFitArtifact(
  fit: ReturnType<typeof fitCalibration>,
  log?: CalibrationLogger,
  updateProgress?: (
    message: string,
    percent: number,
    stage: "fetching" | "finalizing" | "fitting" | "preparing",
  ) => void,
): CalibrationArtifact {
  updateProgress?.("Saving calibration results", 95, "finalizing");
  log?.({
    level: "info",
    message: `Fitting completed. R2: ${String(fit.quality.r2)}, MAPE: ${String(fit.quality.mape)}%. Saving calibration artifact...`,
    operation: "runner.save",
    stage: "finalizing",
  });

  const artifact: CalibrationArtifact = {
    fittedAt: new Date().toISOString(),
    params: { ...DEFAULT_CALIBRATION, baseScale: fit.baseScale },
    propensityByCountry: fit.propensityByCountry,
    quality: fit.quality,
    version: loadCalibration().version + 1,
  };
  saveCalibration(artifact);
  return artifact;
}
