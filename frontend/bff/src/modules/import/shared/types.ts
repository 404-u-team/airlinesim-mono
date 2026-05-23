export type AirportPayload = {
  continent: string;
  country_id: string;
  elevation_ft: number;
  fuel_price_multiplier: number;
  gate_fee: number;
  geog: string;
  geom: string;
  home_link: string;
  iata_code: string;
  icao_code: string;
  intl_name: string;
  local_name: string;
  maintenance_point_price: number;
  max_runway_length_m: number;
  max_runway_uses_per_day: number;
  municipality: string;
  region_id: string;
  runway_fee: number;
  stand_fee: number;
  timezone: string;
  turnaround_point_price: number;
  wikipedia_link: string;
  works_at_night: boolean;
};

export type BackendEntity = {
  id?: string;
  [key: string]: unknown;
};

export type BuildOptions = {
  dataDir?: string;
  refreshRaw?: boolean;
  source?: "cache" | "fetch";
};

export type CountryPayload = {
  aircraft_tail_code: string;
  corp_tax_rate: number;
  flythrough_permission_price: number;
  intl_name: string;
  iso: string;
  land_permission_price: number;
  local_name: string;
  vat_rate: number;
  wikipedia_link: string;
};

export type EntityType = "airport" | "country" | "region" | "region-link";

export type FinalAirport = {
  capacityIndex: number;
  countryIso: string;
  latitude: number;
  longitude: number;
  payload: AirportPayload;
  regionCode: string;
  sourceKey: string;
  type: AirportType;
};

export type FinalCountry = {
  areaKm2: null | number;
  borders: string[];
  continent: string;
  gdpPerCapitaUsd: null | number;
  incomeLevelCode: null | string;
  iso: string;
  languages: string[];
  landlocked: boolean;
  payload: CountryPayload;
  population: null | number;
  sourceKey: string;
  tourismArrivals: null | number;
};

export type FinalRegion = {
  centroid: null | Point;
  continent: string;
  countryIso: string;
  localCode: string;
  payload: RegionPayload;
  sourceKey: string;
};

export type FinalRegionLink = {
  regionACode: string;
  regionBCode: string;
  sameCountry: boolean;
  sourceKey: string;
  sourceRegionA: string;
  sourceRegionB: string;
  values: Omit<RegionLinkPayload, "region_a" | "region_b">;
};

export type ImportMapping = {
  backendId: string;
  entityType: EntityType;
  importedAt: string;
  payloadHash: string;
  sourceKey: string;
};

export type ImportMode = "dry-run" | "import";

export type ImportRequestBody = BuildOptions & {
  mode?: ImportMode;
};

export type ImportReport = {
  counts: Record<string, number>;
  errors: ReportItem[];
  finishedAt: string;
  mode: ImportMode;
  quality: Record<string, number>;
  reportPath?: string;
  skipped: ReportItem[];
  startedAt: string;
  warnings: ReportItem[];
};

export type ImportResult = {
  data: WorldData;
  report: ImportReport;
};

export type Point = {
  latitude: number;
  longitude: number;
};

export type RegionLinkPayload = {
  business: number;
  diaspora: number;
  region_a: string;
  region_b: string;
  tourism: number;
};

export type RegionPayload = {
  business_score: number;
  country_id: string;
  gdp_per_capita: number;
  intl_name: string;
  local_code: string;
  local_name: string;
  population: number;
  tourism_score: number;
  wikipedia_link: string;
};

export type ReportItem = {
  entityType: string;
  message: string;
  sourceKey: string;
};

export type SourceIssueSink = {
  error: (entityType: string, sourceKey: string, message: string) => void;
  reportQuality?: (key: string) => void;
  skip: (entityType: string, sourceKey: string, message: string) => void;
  warn: (entityType: string, sourceKey: string, message: string) => void;
};

export type WorldData = {
  airports: FinalAirport[];
  countries: FinalCountry[];
  regionLinks: FinalRegionLink[];
  regions: FinalRegion[];
};

export type AirportType = "large_airport" | "medium_airport" | "small_airport";
