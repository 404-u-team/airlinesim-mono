import type { BffConfig } from "../../config";
import type { ReadinessIssue, WorldReadiness } from "./types";

import { getUserAuthorization } from "../../auth";
import { requestBackendJson } from "../../backend-http";

type AircraftType = {
  id?: string;
  min_runway_length_m?: number;
};
type Airport = {
  country_id?: string;
  gate_fee?: number;
  geog?: string;
  geom?: string;
  iata_code?: string;
  icao_code?: string;
  id?: string;
  intl_name?: string;
  local_name?: string;
  max_runway_length_m?: number;
  max_runway_uses_per_day?: number;
  region_id?: string;
  runway_fee?: number;
  stand_fee?: number;
  timezone?: string;
  works_at_night?: boolean;
};
type Country = {
  corp_tax_rate?: number;
  flythrough_permission_price?: number;
  id?: string;
  iso?: string;
  land_permission_price?: number;
  vat_rate?: number;
};
type Region = {
  business_score?: number;
  country_id?: string;
  gdp_per_capita?: number;
  id?: string;
  intl_name?: string;
  local_name?: string;
  population?: number;
  tourism_score?: number;
};
type RegionLink = {
  business?: number;
  diaspora?: number;
  id?: string;
  region_a?: string;
  region_b?: string;
  tourism?: number;
};

export async function buildWorldReadiness(request: Request, config: BffConfig): Promise<WorldReadiness> {
  const token = getUserAuthorization(request) ?? "";
  const [countriesResponse, regionsResponse, airportsResponse, linksResponse, typesResponse] = await Promise.all([
    requestBackendJson<{ countries?: Country[] }>(config, "/countries", { token }),
    requestBackendJson<{ regions?: Region[] }>(config, "/regions", { token }),
    requestBackendJson<{ airports?: Airport[] }>(config, "/airports", { token }),
    requestBackendJson<{ region_links?: RegionLink[] }>(config, "/region-links", { token }),
    requestBackendJson<{ items?: AircraftType[] }>(config, "/aircraft-types", { token }),
  ]);
  const countries = countriesResponse.countries ?? [];
  const regions = regionsResponse.regions ?? [];
  const airports = airportsResponse.airports ?? [];
  const links = linksResponse.region_links ?? [];
  const aircraftTypes = typesResponse.items ?? [];
  const blockers = [
    ...countryIssues(countries),
    ...regionIssues(regions, countries),
    ...airportIssues(airports, countries, regions),
    ...regionLinkIssues(links, regions),
    ...productIssues(airports, regions, aircraftTypes),
  ];
  const warnings = demandCacheWarnings(links);

  return {
    blockers,
    checked_at: new Date().toISOString(),
    counts: {
      airports: airports.length,
      countries: countries.length,
      region_links: links.length,
      regions: regions.length,
    },
    entity_summaries: entitySummaries(countries, regions, airports, links, blockers),
    next_actions: nextActions(blockers),
    status: readinessStatus(blockers, warnings),
    warnings,
  };
}

function airportIssues(airports: Airport[], countries: Country[], regions: Region[]): ReadinessIssue[] {
  const countryIds = new Set(countries.map((item) => item.id));
  const regionIds = new Set(regions.map((item) => item.id));
  const regionById = new Map(regions.map((item) => [item.id, item]));
  const iataCounts = countValues(airports.map((airport) => airport.iata_code));
  const icaoCounts = countValues(airports.map((airport) => airport.icao_code));
  const issues: ReadinessIssue[] = [];
  if (airports.length < 2) {
    issues.push(issue("AIRPORTS_INSUFFICIENT", "airport", "/admin/airports", { count: airports.length }));
  }
  for (const airport of airports) {
    if (!hasCompleteAirportData(airport) || invalidAirportCode(airport, iataCounts, icaoCounts)) {
      issues.push(entityIssue("AIRPORT_DATA_INCOMPLETE", "airport", airport.id, airport.iata_code, "/admin/airports"));
    }
    if (invalidAirportReference(airport, countryIds, regionIds, regionById)) {
      issues.push(entityIssue("AIRPORT_REFERENCE_INVALID", "airport", airport.id, airport.iata_code, "/admin/airports"));
    }
  }
  return issues;
}

function countryIssues(countries: Country[]): ReadinessIssue[] {
  if (countries.length === 0) {
    return [issue("COUNTRIES_EMPTY", "country", "/admin/countries", {})];
  }
  const isoCounts = countValues(countries.map((country) => country.iso));

  return countries.flatMap((country) =>
    !country.iso || !/^[A-Z]{2}$/.test(country.iso) || (isoCounts.get(country.iso) ?? 0) > 1 ||
      invalidOptionalMoney(country.flythrough_permission_price) || invalidOptionalMoney(country.land_permission_price) ||
      invalidOptionalRate(country.corp_tax_rate) || invalidOptionalRate(country.vat_rate)
      ? [entityIssue("COUNTRY_ISO_INVALID", "country", country.id, country.iso, "/admin/countries")]
      : [],
  );
}

function countValues(values: Array<string | undefined>): Map<string | undefined, number> {
  const counts = new Map<string | undefined, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return counts;
}

function demandCacheWarnings(links: RegionLink[]): ReadinessIssue[] {
  return links.length > 0
    ? [issue("DEMAND_CACHE_LAZY", "region_link", "/admin/region-links", { link_count: links.length })]
    : [];
}

function entityIssue(
  code: string,
  entityType: ReadinessIssue["entity_type"],
  entityId: string | undefined,
  entityLabel: string | undefined,
  targetPath: string,
): ReadinessIssue {
  return {
    code,
    entity_id: entityId,
    entity_label: entityLabel,
    entity_type: entityType,
    parameters: {},
    target_path: targetPath,
  };
}

function entitySummaries(
  countries: Country[],
  regions: Region[],
  airports: Airport[],
  links: RegionLink[],
  blockers: ReadinessIssue[],
): WorldReadiness["entity_summaries"] {
  const counts = { airport: airports.length, country: countries.length, region: regions.length, region_link: links.length };

  return Object.fromEntries(Object.entries(counts).map(([type, total]) => {
    const invalid = new Set(blockers.filter((item) => item.entity_type === type).map((item) => item.entity_id ?? item.code)).size;
    return [type, { invalid, missing: total === 0 ? 1 : 0, ready: Math.max(0, total - invalid) }];
  }));
}

function hasAirportIdentity(airport: Airport): boolean {
  const hasCoordinates = Boolean(airport.geog ?? airport.geom);

  return Boolean(airport.id && airport.icao_code && airport.iata_code && airport.timezone &&
    airport.intl_name && airport.local_name && hasCoordinates);
}

function hasAirportOperations(airport: Airport): boolean {
  return positive(airport.max_runway_length_m) && positive(airport.max_runway_uses_per_day) &&
    airport.works_at_night !== undefined && nonNegative(airport.runway_fee) &&
    nonNegative(airport.gate_fee) && nonNegative(airport.stand_fee);
}

function hasCompleteAirportData(airport: Airport): boolean {
  return hasAirportIdentity(airport) && hasAirportOperations(airport);
}

function invalidAirportCode(
  airport: Airport,
  iataCounts: Map<string | undefined, number>,
  icaoCounts: Map<string | undefined, number>,
): boolean {
  return !/^[A-Z]{3}$/.test(airport.iata_code ?? "") || !/^[A-Z]{4}$/.test(airport.icao_code ?? "") ||
    (iataCounts.get(airport.iata_code) ?? 0) > 1 || (icaoCounts.get(airport.icao_code) ?? 0) > 1;
}

function invalidAirportReference(
  airport: Airport,
  countryIds: Set<string | undefined>,
  regionIds: Set<string | undefined>,
  regionById: Map<string | undefined, Region>,
): boolean {
  return !countryIds.has(airport.country_id) || !regionIds.has(airport.region_id) ||
    regionById.get(airport.region_id)?.country_id !== airport.country_id;
}

function invalidOptionalMoney(value: number | undefined): boolean {
  return value !== undefined && !nonNegative(value);
}

function invalidOptionalRate(value: number | undefined): boolean {
  return value !== undefined && !score(value);
}

function issue(
  code: string,
  entityType: ReadinessIssue["entity_type"],
  targetPath: string,
  parameters: ReadinessIssue["parameters"],
): ReadinessIssue {
  return { code, entity_type: entityType, parameters, target_path: targetPath };
}

function nextActions(blockers: ReadinessIssue[]): WorldReadiness["next_actions"] {
  const seen = new Set<string>();

  return blockers.filter((item) => {
    if (seen.has(item.target_path)) {
      return false;
    }
    seen.add(item.target_path);
    return true;
  }).slice(0, 5).map((item) => ({ code: `FIX_${item.entity_type.toUpperCase()}`, target_path: item.target_path }));
}

function nonNegative(value: number | undefined): boolean {
  return typeof value === "number" && value >= 0;
}

function positive(value: number | undefined): boolean {
  return typeof value === "number" && value > 0;
}

function productIssues(
  airports: Airport[],
  regions: Region[],
  aircraftTypes: AircraftType[],
): ReadinessIssue[] {
  const usableAirports = airports.filter((airport) => positive(airport.max_runway_length_m) && positive(airport.max_runway_uses_per_day));
  const hasCompatibleAircraft = usableAirports.some((airport) =>
    aircraftTypes.some((type) => positive(type.min_runway_length_m) && (type.min_runway_length_m ?? 0) <= (airport.max_runway_length_m ?? 0)),
  );
  const usableRegionIds = new Set(usableAirports.map((airport) => airport.region_id).filter(Boolean));
  const hasOpportunity = usableRegionIds.size >= 2;

  return [
    ...(!hasCompatibleAircraft ? [issue("PRODUCT_NO_COMPATIBLE_AIRCRAFT", "product", "/admin/airports", {})] : []),
    ...(!hasOpportunity || regions.length < 2 ? [issue("PRODUCT_NO_ROUTE_OPPORTUNITY", "product", "/admin/region-links", {})] : []),
  ];
}

function readinessStatus(
  blockers: ReadinessIssue[],
  warnings: ReadinessIssue[],
): WorldReadiness["status"] {
  if (blockers.length > 0) {
    return "blocked";
  }

  return warnings.length > 0 ? "warning" : "ready";
}

function regionIssues(regions: Region[], countries: Country[]): ReadinessIssue[] {
  const countryIds = new Set(countries.map((country) => country.id));
  if (regions.length === 0) {
    return [issue("REGIONS_EMPTY", "region", "/admin/regions", {})];
  }

  return regions.flatMap((region) => {
    const invalid = !countryIds.has(region.country_id) || !region.local_name || !region.intl_name ||
      !nonNegative(region.population) || !nonNegative(region.gdp_per_capita) ||
      !score(region.tourism_score) || !score(region.business_score);
    return invalid ? [entityIssue("REGION_DATA_INVALID", "region", region.id, region.intl_name, "/admin/regions")] : [];
  });
}

function regionLinkIssues(links: RegionLink[], regions: Region[]): ReadinessIssue[] {
  const regionIds = new Set(regions.map((region) => region.id));
  const pairs = new Set<string>();
  return links.flatMap((link) => {
    const pair = [link.region_a ?? "", link.region_b ?? ""].sort().join(":");
    const invalid = !link.region_a || !link.region_b || link.region_a === link.region_b || pairs.has(pair) ||
      !regionIds.has(link.region_a) || !regionIds.has(link.region_b) ||
      !score(link.business) || !score(link.tourism) || !score(link.diaspora);
    pairs.add(pair);
    return invalid ? [entityIssue("REGION_LINK_INVALID", "region_link", link.id, pair, "/admin/region-links")] : [];
  });
}

function score(value: number | undefined): boolean {
  return typeof value === "number" && value >= 0 && value <= 1;
}
