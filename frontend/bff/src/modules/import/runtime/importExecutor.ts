import type { BffConfig } from "../../../config";
import type {
  AirportPayload,
  EntityType,
  FinalAircraftType,
  FinalAirport,
  FinalCountry,
  FinalRegion,
  FinalRegionLink,
  ImportMode,
  ImportReport,
  RegionLinkPayload,
  RegionPayload,
  WorldData,
} from "../shared/types";

import { getBackendAdminToken, invalidateBackendAdminToken } from "../../../auth";
import { BackendRequestError, backendRequest, extractBackendId } from "../backend/api";
import { camelPlural, createMapping, getMappedId, type ReconcileState } from "./mapping";
import { pushError } from "./report";
import { mappingKey } from "./storage";
import { stableHash } from "../shared/math";

export async function planOrImport(
  config: BffConfig,
  state: ReconcileState,
  data: WorldData,
  report: ImportReport,
  mode: ImportMode,
): Promise<void> {
  if (mode === "dry-run") {
    planEntities(state, data, report);
    return;
  }

  if (!state.backendToken) {
    pushError(report, { entityType: "import", message: "Backend admin credentials are required for import mode", sourceKey: "world-data" });
    return;
  }

  for (const country of data.countries) {
    await importCountry(config, state, report, country);
  }
  for (const aircraftType of data.aircraftTypes) {
    await importAircraftType(config, state, report, aircraftType);
  }
  for (const region of data.regions) {
    await importRegion(config, state, report, region);
  }
  for (const airport of data.airports) {
    await importAirport(config, state, report, airport);
  }
  for (const link of data.regionLinks) {
    await importRegionLink(config, state, report, link);
  }
}

async function importEntity(
  config: BffConfig,
  state: ReconcileState,
  report: ImportReport,
  input: {
    createPath: string;
    entityType: EntityType;
    payload: Record<string, unknown>;
    sourceKey: string;
    updatePath?: (id: string) => string;
  },
): Promise<null | string> {
  const hash = stableHash(input.payload);
  const key = mappingKey(input.entityType, input.sourceKey);
  const existing = state.mappings.get(key);

  if (existing?.payloadHash === hash) {
    report.counts[`${camelPlural(input.entityType)}Skipped`] = (report.counts[`${camelPlural(input.entityType)}Skipped`] ?? 0) + 1;
    return existing.backendId;
  }

  return existing
    ? updateEntity(config, state, report, input, existing.backendId, hash)
    : createEntity(config, state, report, input, hash);
}

async function createEntity(
  config: BffConfig,
  state: ReconcileState,
  report: ImportReport,
  input: Parameters<typeof importEntity>[3],
  hash: string,
): Promise<null | string> {
  const response = await importBackendRequest(config, state, input.createPath, {
    body: input.payload,
    method: "POST",
  });
  const id = extractBackendId(response);

  if (!id) {
    pushError(report, { entityType: input.entityType, message: "Backend response did not include id", sourceKey: input.sourceKey });
    return null;
  }

  state.mappings.set(mappingKey(input.entityType, input.sourceKey), createMapping(input.entityType, input.sourceKey, id, hash));

  return id;
}

async function importAircraftType(
  config: BffConfig,
  state: ReconcileState,
  report: ImportReport,
  aircraftType: FinalAircraftType,
): Promise<void> {
  const existedBefore = state.mappings.has(mappingKey("aircraft-type", aircraftType.sourceKey));
  const id = await importEntity(config, state, report, {
    createPath: "/aircraft-types",
    entityType: "aircraft-type",
    payload: aircraftType.payload,
    sourceKey: aircraftType.sourceKey,
  });

  incrementCreateCount(report, "aircraftTypesToCreate", id, existedBefore);
}

async function importAirport(
  config: BffConfig,
  state: ReconcileState,
  report: ImportReport,
  airport: FinalAirport,
): Promise<void> {
  const countryId = getMappedId(state, "country", airport.payload.country_id);
  const regionId = getMappedId(state, "region", airport.payload.region_id);

  if (!countryId || !regionId) {
    pushError(report, { entityType: "airport", message: "Skipping airport because dependency backend ids are missing", sourceKey: airport.sourceKey });
    return;
  }

  const existedBefore = state.mappings.has(mappingKey("airport", airport.sourceKey));
  const payload: AirportPayload = { ...airport.payload, country_id: countryId, region_id: regionId };
  const id = await importEntity(config, state, report, {
    createPath: "/airport",
    entityType: "airport",
    payload,
    sourceKey: airport.sourceKey,
    updatePath: (backendId) => `/airport/${backendId}`,
  });

  incrementCreateCount(report, "airportsToCreate", id, existedBefore);
}

async function importCountry(
  config: BffConfig,
  state: ReconcileState,
  report: ImportReport,
  country: FinalCountry,
): Promise<void> {
  const existedBefore = state.mappings.has(mappingKey("country", country.sourceKey));
  const id = await importEntity(config, state, report, {
    createPath: "/country",
    entityType: "country",
    payload: country.payload,
    sourceKey: country.sourceKey,
    updatePath: (backendId) => `/country/${backendId}`,
  });

  incrementCreateCount(report, "countriesToCreate", id, existedBefore);
}

async function importRegion(
  config: BffConfig,
  state: ReconcileState,
  report: ImportReport,
  region: FinalRegion,
): Promise<void> {
  const countryId = getMappedId(state, "country", region.payload.country_id);

  if (!countryId) {
    pushError(report, { entityType: "region", message: "Skipping region because country backend id is missing", sourceKey: region.sourceKey });
    return;
  }

  const existedBefore = state.mappings.has(mappingKey("region", region.sourceKey));
  const payload: RegionPayload = { ...region.payload, country_id: countryId };
  const id = await importEntity(config, state, report, {
    createPath: "/region",
    entityType: "region",
    payload,
    sourceKey: region.sourceKey,
    updatePath: (backendId) => `/region/${backendId}`,
  });

  incrementCreateCount(report, "regionsToCreate", id, existedBefore);
}

async function importRegionLink(
  config: BffConfig,
  state: ReconcileState,
  report: ImportReport,
  link: FinalRegionLink,
): Promise<void> {
  const leftId = getMappedId(state, "region", `region:${link.sourceRegionA}`);
  const rightId = getMappedId(state, "region", `region:${link.sourceRegionB}`);

  if (!leftId || !rightId || leftId === rightId) {
    pushError(report, { entityType: "region-link", message: "Skipping link because region backend ids are missing or equal", sourceKey: link.sourceKey });
    return;
  }

  const sortedRegionIds = [leftId, rightId].sort();
  const regionA = sortedRegionIds[0] ?? leftId;
  const regionB = sortedRegionIds[1] ?? rightId;
  const existedBefore = state.mappings.has(mappingKey("region-link", link.sourceKey));
  const payload: RegionLinkPayload = { ...link.values, region_a: regionA, region_b: regionB };
  const id = await importEntity(config, state, report, {
    createPath: "/region-link",
    entityType: "region-link",
    payload,
    sourceKey: link.sourceKey,
    updatePath: (backendId) => `/region-link/${backendId}`,
  });

  incrementCreateCount(report, "regionLinksToCreate", id, existedBefore);
}

function incrementCreateCount(report: ImportReport, key: string, id: null | string, existedBefore: boolean): void {
  if (id && !existedBefore) {
    report.counts[key] = (report.counts[key] ?? 0) + 1;
  }
}

function planEntities(state: ReconcileState, data: WorldData, report: ImportReport): void {
  for (const aircraftType of data.aircraftTypes) {
    planEntity(state, report, "aircraft-type", aircraftType.sourceKey, aircraftType.payload, "aircraftTypesToCreate");
  }
  for (const country of data.countries) {
    planEntity(state, report, "country", country.sourceKey, country.payload, "countriesToCreate");
  }
  for (const region of data.regions) {
    planEntity(state, report, "region", region.sourceKey, region.payload, "regionsToCreate");
  }
  for (const airport of data.airports) {
    planEntity(state, report, "airport", airport.sourceKey, airport.payload, "airportsToCreate");
  }
  for (const link of data.regionLinks) {
    planEntity(state, report, "region-link", link.sourceKey, link.values, "regionLinksToCreate");
  }
}

function planEntity(
  state: ReconcileState,
  report: ImportReport,
  entityType: EntityType,
  sourceKey: string,
  payload: unknown,
  countKey: string,
): void {
  const existing = state.mappings.get(mappingKey(entityType, sourceKey));
  const hash = stableHash(payload);

  if (!existing) {
    report.counts[countKey] = (report.counts[countKey] ?? 0) + 1;
  } else if (existing.payloadHash === hash) {
    report.counts[`${countKey.replace("ToCreate", "")}Skipped`] = (report.counts[`${countKey.replace("ToCreate", "")}Skipped`] ?? 0) + 1;
  } else {
    report.counts.updatesNeeded = (report.counts.updatesNeeded ?? 0) + 1;
  }
}

async function updateEntity(
  config: BffConfig,
  state: ReconcileState,
  report: ImportReport,
  input: Parameters<typeof importEntity>[3],
  backendId: string,
  hash: string,
): Promise<null | string> {
  const token = state.backendToken;
  if (!token) {
    pushError(report, { entityType: input.entityType, message: "Backend token is missing", sourceKey: input.sourceKey });
    return null;
  }

  report.counts.updatesNeeded = (report.counts.updatesNeeded ?? 0) + 1;
  if (!input.updatePath) {
    pushError(report, { entityType: input.entityType, message: "Skipping update because backend update endpoint is not available", sourceKey: input.sourceKey });
    return null;
  }

  const response = await importBackendRequest(config, state, input.updatePath(backendId), {
    body: { ...input.payload, id: backendId },
    method: "PUT",
  });
  const responseId = extractBackendId(response) ?? backendId;
  state.mappings.set(mappingKey(input.entityType, input.sourceKey), createMapping(input.entityType, input.sourceKey, responseId, hash));

  return responseId;
}

async function importBackendRequest<TValue>(
  config: BffConfig,
  state: ReconcileState,
  path: string,
  options: {
    body: Record<string, unknown>;
    method: "POST" | "PUT";
  },
): Promise<TValue> {
  const token = state.backendToken;
  if (!token) {
    throw new Error("Backend token is missing");
  }

  try {
    return await backendRequest<TValue>(config, path, { ...options, token });
  } catch (error) {
    if (!(error instanceof BackendRequestError) || (error.status !== 401 && error.status !== 403)) {
      throw error;
    }

    invalidateBackendAdminToken();
    const refreshedToken = await getBackendAdminToken(config);
    setBackendToken(state, refreshedToken);

    return backendRequest<TValue>(config, path, { ...options, token: refreshedToken });
  }
}

function setBackendToken(state: ReconcileState, token: string): void {
  state.backendToken = token;
}
