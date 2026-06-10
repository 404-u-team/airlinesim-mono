import { parseGeoPoint } from "../../geo";
import { distanceKm } from "../import/shared/math";
import { type AnchorStore, getCalibrationAnchors } from "./anchors";
import { type CalibrationArtifact, loadCalibration, saveCalibration } from "./calibration";
import { type CalibrationAnchor, fitCalibration } from "./calibration-fit";
import { DEFAULT_CALIBRATION, explainPairDemand, type MarketEndpoint } from "./model";
import { airportPairStrengthFactor, airportStrengthFactor, getAirportProfile } from "./profiles";

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
  // Error broken down by segment so tuning is data-driven, not blind: which
  // buckets the model systematically over/under-shoots. See buildSegments.
  segments: SegmentRow[];
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

// One diagnostic bucket: how the calibrated model does on a slice of the anchors.
// medianRatio/meanRatio are model/real (>1 = overestimation); mape is a fraction.
export type SegmentRow = {
  count: number;
  group: "distance" | "realDaily" | "strength";
  key: string;
  label: string;
  mape: number;
  meanRatio: number;
  medianRatio: number;
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

// Decomposes the calibrated error into segments (real-traffic buckets, airport-
// strength tiers, distance bands) so we can see *where* the model is biased instead
// of tuning coefficients blind. Each row reports median & geometric-mean of
// model/real (>1 = overestimation) and the MAPE fraction for that slice.
export function buildSegments(
  anchors: CalibrationAnchor[],
  baseScale: number,
  propensity: Record<string, number>,
): SegmentRow[] {
  const points = anchors.map((anchor) => {
    const factor = Math.sqrt((propensity[anchor.originCountry] ?? 1) * (propensity[anchor.destCountry] ?? 1));
    const model = baseScale * factor * anchor.structural;
    return {
      distanceKm: anchor.distanceKm ?? 0,
      ratio: model / anchor.dailyPax,
      real: anchor.dailyPax,
      tier: strengthTier(anchor.originStrength, anchor.destStrength),
    };
  });

  const rows: SegmentRow[] = [];
  const push = (group: SegmentRow["group"], key: string, label: string, subset: typeof points): void => {
    if (subset.length > 0) {
      rows.push({ ...ratioStats(subset.map((p) => p.ratio)), count: subset.length, group, key, label });
    }
  };

  push("realDaily", "lt50", "real < 50/day", points.filter((p) => p.real < 50));
  push("realDaily", "50-150", "50–150/day", points.filter((p) => p.real >= 50 && p.real < 150));
  push("realDaily", "150-500", "150–500/day", points.filter((p) => p.real >= 150 && p.real < 500));
  push("realDaily", "gte500", "500+/day", points.filter((p) => p.real >= 500));

  push("strength", "primary-primary", "primary ↔ primary", points.filter((p) => p.tier === "primary-primary"));
  push("strength", "primary-secondary", "primary ↔ secondary", points.filter((p) => p.tier === "primary-secondary"));
  push("strength", "secondary-secondary", "secondary ↔ secondary", points.filter((p) => p.tier === "secondary-secondary"));

  push("distance", "lt500", "< 500 km", points.filter((p) => p.distanceKm < 500));
  push("distance", "500-1000", "500–1000 km", points.filter((p) => p.distanceKm >= 500 && p.distanceKm < 1000));
  push("distance", "1000-2000", "1000–2000 km", points.filter((p) => p.distanceKm >= 1000 && p.distanceKm < 2000));
  push("distance", "gte2000", "2000+ km", points.filter((p) => p.distanceKm >= 2000));

  return rows;
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
        destStrength: resolved.destStrength,
        distanceKm: resolved.distanceKm,
        originCountry: resolved.originCountry,
        originIata: record.originIata.toUpperCase(),
        originStrength: resolved.originStrength,
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
): null | {
  destCountry: string;
  destStrength: number;
  distanceKm: number;
  originCountry: string;
  originStrength: number;
  structural: number;
} {
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

  const distance = pairDistance(origin, destination);
  const { result } = explainPairDemand(
    endpointFor(origin, originRegion),
    endpointFor(destination, destRegion),
    distance,
    {},
    STRUCTURAL_CALIBRATION,
  );

  const shareFactor = airportShare(origin.icao_code) * airportShare(destination.icao_code);
  const strengthFactor = airportPairStrengthFactor(origin.icao_code, destination.icao_code);
  const structural = ((result.originToDestination + result.destinationToOrigin) / 2) * shareFactor * strengthFactor;

  return {
    destCountry,
    destStrength: airportStrengthFactor(destination.icao_code),
    distanceKm: distance,
    originCountry,
    originStrength: airportStrengthFactor(origin.icao_code),
    structural,
  };
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
    segments: buildSegments(fitAnchors, fit.baseScale, fit.propensityByCountry),
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

// Geometric-mean & median of model/real ratios + the MAPE fraction for a slice.
// Geometric mean (not arithmetic) so a 10× overshoot and a 10× undershoot cancel.
function ratioStats(ratios: number[]): { mape: number; meanRatio: number; medianRatio: number } {
  const sorted = [...ratios].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const medianRatio = sorted.length % 2 === 0 ? ((sorted[mid - 1] ?? 1) + (sorted[mid] ?? 1)) / 2 : sorted[mid] ?? 1;
  const logMean = ratios.reduce((sum, r) => sum + Math.log(r), 0) / ratios.length;
  const mape = ratios.reduce((sum, r) => sum + Math.abs(r - 1), 0) / ratios.length;
  return { mape: round3(mape), meanRatio: round3(Math.exp(logMean)), medianRatio: round3(medianRatio) };
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

// A "primary" airport has a strong capacityIndex (≥ 0.8: a real hub/major field).
// Anything weaker is "secondary" (regional/low-cost/secondary metro field). Missing
// strength (pre-import) is treated as primary so the fallback stays neutral.
function strengthTier(originStrength: number | undefined, destStrength: number | undefined): string {
  const a = (originStrength ?? 1) >= 0.8;
  const b = (destStrength ?? 1) >= 0.8;
  if (a && b) {
    return "primary-primary";
  }
  return a || b ? "primary-secondary" : "secondary-secondary";
}
