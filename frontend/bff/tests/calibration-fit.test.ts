import { expect, test } from "bun:test";

import type { CalibrationAnchor } from "../src/modules/demand/calibration-fit";

import { fitCalibration } from "../src/modules/demand/calibration-fit";

const TRUE_PROPENSITY: Record<string, number> = { A: 1, B: 0.25, C: 4 }; // geomean = 1
const TRUE_BASE_SCALE = 2;

// Synthesises a perfect anchor from the true parameters so the fit should recover
// them (up to the geometric-mean-1 normalisation, which the truth already satisfies).
function anchor(originCountry: string, destCountry: string, structural: number): CalibrationAnchor {
  const factor = Math.sqrt(TRUE_PROPENSITY[originCountry]! * TRUE_PROPENSITY[destCountry]!);
  return {
    dailyPax: TRUE_BASE_SCALE * factor * structural,
    destCountry,
    destIata: `${destCountry}2`,
    originCountry,
    originIata: `${originCountry}1`,
    structural,
  };
}

test("fit recovers per-country propensity ratios and base scale from clean anchors", () => {
  const anchors = [
    anchor("A", "B", 1000),
    anchor("A", "C", 800),
    anchor("B", "C", 1200),
    anchor("A", "A", 600),
    anchor("B", "B", 400),
    anchor("C", "C", 900),
    anchor("A", "B", 300),
    anchor("B", "C", 700),
    anchor("A", "C", 500),
  ];

  const fit = fitCalibration(anchors);

  expect(fit.baseScale).toBeCloseTo(TRUE_BASE_SCALE, 1);
  // Ratios between countries must match the truth.
  expect(fit.propensityByCountry.C! / fit.propensityByCountry.B!).toBeCloseTo(16, 0);
  expect(fit.propensityByCountry.A! / fit.propensityByCountry.B!).toBeCloseTo(4, 0);
  // A near 1 (geomean normalisation), perfect fit.
  expect(fit.propensityByCountry.A!).toBeCloseTo(1, 1);
  expect(fit.quality.r2).toBeGreaterThan(0.99);
  expect(fit.quality.mape).toBeLessThan(1);
  expect(fit.quality.pairs).toBe(9);
  // Perfect fit ⇒ log-error percentiles ≈ 0, and they must be ordered.
  expect(fit.quality.medianAbsLogError).toBeLessThan(0.01);
  expect(fit.quality.p95AbsLogError).toBeGreaterThanOrEqual(fit.quality.p90AbsLogError);
  expect(fit.quality.p90AbsLogError).toBeGreaterThanOrEqual(fit.quality.medianAbsLogError);
});

test("log-error percentiles widen with noisy anchors and stay ordered", () => {
  // Inject multiplicative noise so the fit cannot be perfect; percentiles must grow.
  const noisy: CalibrationAnchor[] = [];
  const factors = [0.2, 0.5, 1, 1, 1, 2, 5, 1.3, 0.7];
  factors.forEach((f, i) => {
    noisy.push({ dailyPax: 100 * f, destCountry: "B", destIata: `B${String(i)}`, originCountry: "A", originIata: `A${String(i)}`, structural: 100 });
  });
  const fit = fitCalibration(noisy);
  expect(fit.quality.medianAbsLogError).toBeGreaterThan(0);
  expect(fit.quality.p90AbsLogError).toBeGreaterThanOrEqual(fit.quality.medianAbsLogError);
  expect(fit.quality.p95AbsLogError).toBeGreaterThanOrEqual(fit.quality.p90AbsLogError);
});

test("empty anchors return safe defaults", () => {
  const fit = fitCalibration([]);
  expect(fit.quality.pairs).toBe(0);
  expect(fit.baseScale).toBeGreaterThan(0);
});

test("a low-propensity country gets a sub-1 multiplier (rail-suppressed style)", () => {
  // D flies far less than its size implies; should fit < 1 relative to E.
  const anchors: CalibrationAnchor[] = [
    { dailyPax: 100, destCountry: "E", destIata: "E2", originCountry: "D", originIata: "D1", structural: 1000 },
    { dailyPax: 1200, destCountry: "E", destIata: "E3", originCountry: "E", originIata: "E1", structural: 1000 },
    { dailyPax: 90, destCountry: "D", destIata: "D2", originCountry: "D", originIata: "D3", structural: 1000 },
  ];

  const fit = fitCalibration(anchors);
  expect(fit.propensityByCountry.D!).toBeLessThan(fit.propensityByCountry.E!);
});
