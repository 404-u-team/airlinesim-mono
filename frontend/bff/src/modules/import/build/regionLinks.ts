import type { FinalCountry, FinalRegion, FinalRegionLink } from "../shared/types";
import type { BuildContext, LinkCandidate } from "./types";

import { clamp, distanceKm, percentile95, round2, scaleByP95 } from "../shared/math";
import { linkScore, nearbyRegions, overrideFor } from "./shared";

export function buildRegionLinks(
  context: BuildContext,
  countries: FinalCountry[],
  regions: FinalRegion[],
): FinalRegionLink[] {
  const countryByIso = new Map(countries.map((country) => [country.iso, country]));
  const candidates = new Map<string, LinkCandidate>();
  const topRegions = [...regions].sort((a, b) => linkScore(b) - linkScore(a)).slice(0, 300);

  for (let leftIndex = 0; leftIndex < regions.length; leftIndex += 1) {
    addNearestCandidates(candidates, regions[leftIndex], regions, countryByIso);
    addDistanceCandidates(candidates, regions[leftIndex], regions, topRegions, countryByIso, leftIndex);
  }

  const normalized = normalizeCandidates(context, [...candidates.values()]);

  return pruneLinks(normalized);
}

function addDistanceCandidates(
  candidates: Map<string, LinkCandidate>,
  left: FinalRegion | undefined,
  regions: FinalRegion[],
  topRegions: FinalRegion[],
  countryByIso: Map<string, FinalCountry>,
  leftIndex: number,
): void {
  if (!left?.centroid) {
    return;
  }

  for (let rightIndex = leftIndex + 1; rightIndex < regions.length; rightIndex += 1) {
    const right = regions[rightIndex];
    if (!right?.centroid) {
      continue;
    }

    const distance = distanceKm(left.centroid.latitude, left.centroid.longitude, right.centroid.latitude, right.centroid.longitude);
    const topPair = topRegions.includes(left) && topRegions.includes(right) && distance <= 10000;

    if (left.countryIso === right.countryIso || distance <= 1500 || topPair) {
      addLinkCandidate(candidates, left, right, countryByIso, distance);
    }
  }
}

function addLinkCandidate(
  candidates: Map<string, LinkCandidate>,
  left: FinalRegion,
  right: FinalRegion,
  countries: Map<string, FinalCountry>,
  distance: number,
): void {
  if (left.localCode === right.localCode || !left.centroid || !right.centroid) {
    return;
  }

  const [sourceRegionA, sourceRegionB] = [left.localCode, right.localCode].sort();
  const key = `region-link:${sourceRegionA ?? left.localCode}:${sourceRegionB ?? right.localCode}`;
  const countryA = countries.get(left.countryIso);
  const countryB = countries.get(right.countryIso);
  const sameCountry = left.countryIso === right.countryIso;
  const sameContinent = left.continent === right.continent;
  const sharedLanguage = Boolean(countryA?.languages.some((language) => countryB?.languages.includes(language)));
  const populationBalance = Math.sqrt(Math.min(left.payload.population, right.payload.population) / Math.max(left.payload.population, right.payload.population));
  const rawDiaspora = (sameCountry ? 0.35 : 0) + (sharedLanguage ? 0.15 : 0) + (sameContinent ? 0.08 : 0) + 0.25 / (1 + distance / 2000) + 0.17 * populationBalance;
  const rawBusiness = Math.sqrt(left.payload.business_score * right.payload.business_score) * (0.35 + 0.65 / (1 + distance / 4500)) * (sameContinent ? 1.08 : 1) * (sameCountry ? 1.15 : 1);
  const tourismAttractiveness = Math.sqrt(Math.max(left.payload.tourism_score, right.payload.tourism_score) * clamp((left.payload.tourism_score + right.payload.tourism_score) / 2 + 0.25, 0, 1));
  const rawTourism = tourismAttractiveness * (0.45 + 0.55 / (1 + distance / 7000)) * (sameCountry ? 1.15 : 1);

  candidates.set(key, {
    distanceKm: distance,
    rawBusiness,
    rawDiaspora,
    rawTourism,
    regionACode: left.localCode,
    regionBCode: right.localCode,
    sameCountry,
    sourceKey: key,
    sourceRegionA: sourceRegionA ?? left.localCode,
    sourceRegionB: sourceRegionB ?? right.localCode,
    values: { business: rawBusiness, diaspora: rawDiaspora, tourism: rawTourism },
  });
}

function addNearestCandidates(
  candidates: Map<string, LinkCandidate>,
  left: FinalRegion | undefined,
  regions: FinalRegion[],
  countryByIso: Map<string, FinalCountry>,
): void {
  if (!left) {
    return;
  }

  for (const { distance, region: right } of nearbyRegions(left, regions).slice(0, 40)) {
    addLinkCandidate(candidates, left, right, countryByIso, distance);
  }
}

function normalizeCandidates(context: BuildContext, rawLinks: LinkCandidate[]): FinalRegionLink[] {
  const diasporaP95 = percentile95(rawLinks.map((link) => link.rawDiaspora));
  const businessP95 = percentile95(rawLinks.map((link) => link.rawBusiness));
  const tourismP95 = percentile95(rawLinks.map((link) => link.rawTourism));

  return rawLinks
    .map((link) => normalizeRegionLink(context, link, diasporaP95, businessP95, tourismP95))
    .filter((link) => link.sameCountry || Math.max(link.values.business, link.values.diaspora, link.values.tourism) >= 0.05);
}

function normalizeRegionLink(
  context: BuildContext,
  link: LinkCandidate,
  diasporaP95: number,
  businessP95: number,
  tourismP95: number,
): FinalRegionLink {
  const override = overrideFor(context.raw.manual.regionLinks, link.sourceKey, `${link.sourceRegionA}:${link.sourceRegionB}`);

  return {
    ...link,
    values: {
      business: clamp(pickLinkOverride(override, "business") ?? round2(scaleByP95(link.rawBusiness, businessP95)), 0, 1),
      diaspora: clamp(pickLinkOverride(override, "diaspora") ?? round2(scaleByP95(link.rawDiaspora, diasporaP95)), 0, 1),
      tourism: clamp(pickLinkOverride(override, "tourism") ?? round2(scaleByP95(link.rawTourism, tourismP95)), 0, 1),
    },
  };
}

function pickLinkOverride(override: Record<string, unknown>, key: string): null | number {
  const value = override[key];

  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function pruneLinks(links: FinalRegionLink[]): FinalRegionLink[] {
  const scores = new Map<string, FinalRegionLink[]>();

  for (const link of links) {
    scores.set(link.sourceRegionA, [...(scores.get(link.sourceRegionA) ?? []), link]);
    scores.set(link.sourceRegionB, [...(scores.get(link.sourceRegionB) ?? []), link]);
  }

  const keep = new Set<string>();
  for (const regionLinks of scores.values()) {
    for (const link of regionLinks.sort((a, b) => linkScore(b) - linkScore(a)).slice(0, 50)) {
      keep.add(link.sourceKey);
    }
  }

  return links.filter((link) => keep.has(link.sourceKey));
}
