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
  originCountry: string;
  originIata: string;
  // model prediction with baseScale = 1 and propensity = 1
  structural: number;
};

export type CalibrationFit = {
  baseScale: number;
  propensityByCountry: Record<string, number>;
  quality: { mape: number; pairs: number; r2: number };
};

const DEFAULT_ITERATIONS = 200;
const MIN_PROPENSITY = 0.05;
const MAX_PROPENSITY = 20;

export function fitCalibration(anchors: CalibrationAnchor[], iterations = DEFAULT_ITERATIONS): CalibrationFit {
  const usable = anchors.filter((a) => a.dailyPax > 0 && a.structural > 0);
  if (usable.length === 0) {
    return { baseScale: 1.8, propensityByCountry: {}, quality: { mape: 0, pairs: 0, r2: 0 } };
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

function quality(anchors: CalibrationAnchor[], baseScale: number, logProp: Map<string, number>): { mape: number; pairs: number; r2: number } {
  const observed = anchors.map((a) => Math.log(a.dailyPax));
  const predicted = anchors.map((a) => {
    const factor = Math.sqrt(Math.exp(logProp.get(a.originCountry) ?? 0) * Math.exp(logProp.get(a.destCountry) ?? 0));
    return Math.log(baseScale * factor * a.structural);
  });
  const observedMean = mean(observed);
  const ssTot = observed.reduce((sum, v) => sum + (v - observedMean) ** 2, 0);
  const ssRes = observed.reduce((sum, v, i) => sum + (v - (predicted[i] ?? 0)) ** 2, 0);
  const mape =
    mean(anchors.map((a, i) => Math.abs(a.dailyPax - Math.exp(predicted[i] ?? 0)) / a.dailyPax)) * 100;

  return { mape: round3(mape), pairs: anchors.length, r2: round3(ssTot > 0 ? 1 - ssRes / ssTot : 0) };
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}
