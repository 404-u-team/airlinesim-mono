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

export type CalibrationArtifact = {
  fittedAt?: string;
  params: CalibrationParams;
  propensityByCountry: Record<string, number>;
  quality?: { mape?: number; pairs?: number; r2?: number };
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


