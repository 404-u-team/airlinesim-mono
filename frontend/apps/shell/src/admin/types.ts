export type AdminColumn = {
  key: string;
  label: string;
};

export type AdminEntityConfig = {
  collectionKey: string;
  columns: AdminColumn[];
  createPath: string;
  description: string;
  editPath: (id: string) => string;
  fields: AdminField[];
  id: AdminEntityId;
  listPath: string;
  title: string;
};

export type AdminEntityId = "airports" | "countries" | "region-links" | "regions";

export type AdminField = {
  key: string;
  kind: AdminFieldKind;
  label: string;
  required?: boolean;
  selectSource?: AdminSelectSource;
};

export type AdminFieldKind = "boolean" | "number" | "select" | "text";

export type AdminFormValues = Record<string, string>;

export type AdminRecord = Record<string, unknown> & {
  id?: string;
};

export type AdminSelectSource = "countries" | "regions";

export type AircraftImageCandidate = {
  commonsFile?: string;
  imageUrl: string;
  pageUrl?: string;
  qid?: string;
  searchQuery?: string;
  source?: string;
  title?: string;
};

export type AircraftType = {
  base_maintenance_points: number;
  base_turnaround_points: number;
  characteristics?: string;
  cruising_speed_kph: number;
  d_check_interval_fh: number;
  d_check_interval_years: number;
  d_check_overdue_multiplier: number;
  fuel_consumption_per_hour: number;
  iata_code: string;
  icao_code: string;
  id: string;
  image_upload_id?: string;
  image_url?: string;
  maint_cost_per_flight_hour: number;
  maint_cost_per_landing: number;
  maint_cost_per_takeoff: number;
  manufacturer_id: string;
  max_planned_seat_capacity: number;
  max_range_km: number;
  min_runway_length_m: number;
  model_name: string;
  mtow_kg: number;
  price_per_unit: number;
  production_points_price: number;
};

export type CalibrationArtifact = {
  fittedAt?: string;
  params: CalibrationParams;
  propensityByCountry: Record<string, number>;
  quality?: {
    bias?: number;
    mape?: number;
    medianAbsLogError?: number;
    medianRatio?: number;
    p90AbsLogError?: number;
    p95AbsLogError?: number;
    pairs?: number;
    r2?: number;
  };
  version: number;
};

export type CalibrationJobStatus = {
  error?: string;
  finishedAt?: string;
  id: string;
  logs: CalibrationLogEntry[];
  progress: CalibrationProgress;
  result?: CalibrationRunResult;
  startedAt: string;
  status: "failed" | "queued" | "running" | "succeeded";
};

export type CalibrationLogEntry = {
  details?: unknown;
  entityType?: string;
  level: "error" | "info" | "warning";
  message: string;
  operation: string;
  sourceKey?: string;
  stage: "fetching" | "finalizing" | "fitting" | "preparing";
  timestamp: string;
};

export type CalibrationParams = {
  affinityBase: number;
  affinityBusiness: number;
  affinityDiaspora: number;
  affinityTourism: number;
  baseScale: number;
  distanceD0: number;
  distanceP: number;
  gdpElasticity: number;
  populationElasticity: number;
};

export type CalibrationProgress = {
  message: string;
  percent: number;
  stage: "fetching" | "finalizing" | "fitting" | "preparing";
};

export type CalibrationRunResult = {
  anchorsTotal: number;
  anchorsUsed: number;
  artifact: CalibrationArtifact;
  scorecard: ScorecardRow[];
  segments?: SegmentRow[];
};

export type CreateAircraftTypePayload = Omit<AircraftType, "id" | "image_url">;

export type DemandPairResult = {
  breakdown: Record<string, boolean | number | string>;
  destinationDailyPassengers: number;
  destinationIata: string;
  destinationName: string;
  distanceKm: number;
  originDailyPassengers: number;
  originIata: string;
  originName: string;
};

export type FutureEntity = {
  description: string;
  missing: string[];
  route: string;
  title: string;
  unlockCriteria: string[];
};

export type ScorecardRow = {
  destIata: string;
  errorPct: number;
  modelDailyPax: number;
  originIata: string;
  realDailyPax: number;
};

export type SegmentRow = {
  count: number;
  group: "distance" | "realDaily" | "strength";
  key: string;
  label: string;
  mape: number;
  meanRatio: number;
  medianRatio: number;
};


