export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function deterministicRange(seed: string, min: number, max: number): number {
  return min + deterministicUnit(seed) * (max - min);
}

export function distanceKm(
  latitudeA: number,
  longitudeA: number,
  latitudeB: number,
  longitudeB: number,
): number {
  const dLat = toRadians(latitudeB - latitudeA);
  const dLon = toRadians(longitudeB - longitudeA);
  const latA = toRadians(latitudeA);
  const latB = toRadians(latitudeB);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(latA) * Math.cos(latB) * Math.sin(dLon / 2) ** 2;

  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function normalizeLog(value: number, min: number, max: number): number {
  if (max <= min) {
    return 0;
  }

  return clamp(
    (Math.log(1 + value) - Math.log(1 + min)) / (Math.log(1 + max) - Math.log(1 + min)),
    0,
    1,
  );
}

export function percentile95(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil(sorted.length * 0.95) - 1;

  return sorted[clamp(index, 0, sorted.length - 1)] ?? 0;
}

export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function roundTo(value: number, step: number): number {
  return Math.round(value / step) * step;
}

export function safeDiv(numerator: number, denominator: null | number | undefined, fallback: number): number {
  if (!denominator || !Number.isFinite(denominator)) {
    return fallback;
  }

  return numerator / denominator;
}

export function scaleByP95(value: number, p95: number): number {
  if (p95 <= 0) {
    return 0;
  }

  return clamp(value / p95, 0, 1);
}

export function stableHash(value: unknown): string {
  const input = canonicalJson(value);
  let hash = 2166136261;

  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(16).padStart(8, "0");
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(",")}]`;
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const body = Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
      .join(",");

    return `{${body}}`;
  }

  return JSON.stringify(value);
}

function deterministicUnit(seed: string): number {
  return Number.parseInt(stableHash(seed), 16) / 0x1_0000_0000;
}

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}
