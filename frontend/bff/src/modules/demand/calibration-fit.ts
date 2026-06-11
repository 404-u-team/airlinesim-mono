// Calibration fit engine (Layer 2). Fits the global baseScale and a per-country
// aviation-propensity multiplier so the model reproduces real anchor traffic.
//
// In log space the model is linear:
//   log(real) = log(baseScale) + 0.5·(logPropA + logPropB) + log(structural)
// where `structural` is the model's prediction with baseScale = 1 and every
// propensity = 1 (i.e. gravity · affinity · shortHaul · direction · airportShare).
//
// We solve it as a country fixed-effects least squares by alternating updates
// (Gauss–Seidel), normalising the propensities to geometric mean 1 each pass so
// baseScale carries the global level and propensity stays relative. Pure function;
// see docs/passenger-demand-model.md "Калибровка".

export type CalibrationAnchor = {
  // observed one-way passengers per day for the pair
  dailyPax: number;
  destCountry: string;
  destIata: string;
  // airport strength (capacityIndex-based, 0..~1.2) of each end, for diagnostics
  destStrength?: number;
  // great-circle km between the airports, for distance-segment diagnostics
  distanceKm?: number;
  originCountry: string;
  originIata: string;
  originStrength?: number;
  // model prediction with baseScale = 1 and propensity = 1
  structural: number;
};

export type CalibrationFit = {
  baseScale: number;
  propensityByCountry: Record<string, number>;
  quality: FitQuality;
};

export type FitQuality = {
  // Geometric-mean ratio model/real. 1 = unbiased; >1 = systematic overestimation.
  bias: number;
  // Mean absolute percentage error as a FRACTION (0.15 = 15%). The UI renders it as
  // a percent; do not multiply by 100 here. MAPE is dominated by tiny-denominator
  // (thin) routes, so prefer medianRatio/bias when judging systematic skew.
  mape: number;
  // |log(model/real)| percentiles — the honest dispersion of the fit, unswayed by
  // the tiny-denominator routes MAPE explodes on. median ≈ typical multiplicative
  // error (0.69 ≈ a typical pair is off by ~2×); p90/p95 size the tail.
  medianAbsLogError: number;
  // Median of model/real across pairs — robust to the thin-route outliers MAPE
  // explodes on. 1 = a typical pair is bang on.
  medianRatio: number;
  p90AbsLogError: number;
  p95AbsLogError: number;
  pairs: number;
  // Coefficient of determination in log space (can be negative when the fit is
  // worse than predicting the mean — common here as gravity caps at corr≈0.53).
  r2: number;
};

const DEFAULT_ITERATIONS = 200;
// Propensity is a relative country multiplier (geomean 1). Kept in a sane band so a
// few sparse-data / low-GDP countries can't rail to absurd values (Egypt ×18 etc.).
const MIN_PROPENSITY = 0.25;
const MAX_PROPENSITY = 4;

export function fitCalibration(anchors: CalibrationAnchor[], iterations = DEFAULT_ITERATIONS): CalibrationFit {
  const usable = anchors.filter((a) => a.dailyPax > 0 && a.structural > 0);
  if (usable.length === 0) {
    return {
      baseScale: 1.8,
      propensityByCountry: {},
      quality: { bias: 1, mape: 0, medianAbsLogError: 0, medianRatio: 1, p90AbsLogError: 0, p95AbsLogError: 0, pairs: 0, r2: 0 },
    };
  }

  // r_k = log(real) - log(structural); target r_k ≈ b + 0.5(p_a + p_b).
  const residuals = usable.map((a) => Math.log(a.dailyPax) - Math.log(a.structural));
  const countries = [...new Set(usable.flatMap((a) => [a.originCountry, a.destCountry]))];
  const logProp = new Map<string, number>(countries.map((c) => [c, 0]));
  let b = mean(residuals);

  for (let iter = 0; iter < iterations; iter += 1) {
    for (const country of countries) {
      let numerator = 0;
      let denominator = 0;
      usable.forEach((anchor, index) => {
        const ends = (anchor.originCountry === country ? 1 : 0) + (anchor.destCountry === country ? 1 : 0);
        if (ends === 0) {
          return;
        }
        const coefficient = 0.5 * ends;
        const otherOrigin = anchor.originCountry === country ? 0 : 0.5 * (logProp.get(anchor.originCountry) ?? 0);
        const otherDest = anchor.destCountry === country ? 0 : 0.5 * (logProp.get(anchor.destCountry) ?? 0);
        const target = (residuals[index] ?? 0) - b - otherOrigin - otherDest;
        numerator += coefficient * target;
        denominator += coefficient * coefficient;
      });
      if (denominator > 0) {
        logProp.set(country, clampLog(numerator / denominator));
      }
    }

    b = mean(usable.map((anchor, index) => (residuals[index] ?? 0) - 0.5 * ((logProp.get(anchor.originCountry) ?? 0) + (logProp.get(anchor.destCountry) ?? 0))));

    // Normalise propensities to geometric mean 1; baseScale absorbs the level.
    const drift = mean([...logProp.values()]);
    for (const country of countries) {
      logProp.set(country, (logProp.get(country) ?? 0) - drift);
    }
    b += drift;
  }

  const baseScale = Math.exp(b);
  const propensityByCountry: Record<string, number> = {};
  for (const [country, value] of logProp) {
    propensityByCountry[country] = round3(Math.exp(value));
  }

  return { baseScale: round3(baseScale), propensityByCountry, quality: quality(usable, baseScale, logProp) };
}

function clampLog(value: number): number {
  return Math.max(Math.log(MIN_PROPENSITY), Math.min(Math.log(MAX_PROPENSITY), value));
}

function mean(values: number[]): number {
  return values.length === 0 ? 0 : values.reduce((sum, v) => sum + v, 0) / values.length;
}

function median(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2 : sorted[mid] ?? 0;
}

// Percentile of an already-ascending array (nearest-rank).
function percentile(sortedAsc: number[], q: number): number {
  if (sortedAsc.length === 0) {
    return 0;
  }
  const index = Math.min(sortedAsc.length - 1, Math.floor(q * sortedAsc.length));
  return sortedAsc[index] ?? 0;
}

function quality(anchors: CalibrationAnchor[], baseScale: number, logProp: Map<string, number>): FitQuality {
  const observed = anchors.map((a) => Math.log(a.dailyPax));
  const predicted = anchors.map((a) => {
    const factor = Math.sqrt(Math.exp(logProp.get(a.originCountry) ?? 0) * Math.exp(logProp.get(a.destCountry) ?? 0));
    return Math.log(baseScale * factor * a.structural);
  });
  const observedMean = mean(observed);
  const ssTot = observed.reduce((sum, v) => sum + (v - observedMean) ** 2, 0);
  const ssRes = observed.reduce((sum, v, i) => sum + (v - (predicted[i] ?? 0)) ** 2, 0);

  // Ratios model/real, in log space (robust to the wide dynamic range of pax).
  const logRatios = anchors.map((a, i) => (predicted[i] ?? 0) - Math.log(a.dailyPax));
  const absLogSorted = logRatios.map(Math.abs).sort((x, y) => x - y);
  // MAPE as a fraction — the UI multiplies by 100 to render a percent.
  const mape = mean(anchors.map((a, i) => Math.abs(a.dailyPax - Math.exp(predicted[i] ?? 0)) / a.dailyPax));

  return {
    bias: round3(Math.exp(mean(logRatios))),
    mape: round3(mape),
    medianAbsLogError: round3(percentile(absLogSorted, 0.5)),
    medianRatio: round3(Math.exp(median(logRatios))),
    p90AbsLogError: round3(percentile(absLogSorted, 0.9)),
    p95AbsLogError: round3(percentile(absLogSorted, 0.95)),
    pairs: anchors.length,
    r2: round3(ssTot > 0 ? 1 - ssRes / ssTot : 0),
  };
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}
