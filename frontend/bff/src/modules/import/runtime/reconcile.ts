import type { BffConfig } from "../../../config";
import type { EntityType, ImportMode, ImportReport, WorldData } from "../shared/types";

import { getBackendAdminToken } from "../../../auth";
import { loadBackendSnapshot } from "../backend/api";
import { createMapping, stringField, type ReconcileState } from "./mapping";
import { pushError, pushWarning } from "./report";
import { mappingKey, readMappings } from "./storage";
import { stableHash } from "../shared/math";

export async function prepareReconcileState(
  config: BffConfig,
  mode: ImportMode,
  mappingPath: string,
  report: ImportReport,
): Promise<ReconcileState> {
  const mappings = await readMappings(mappingPath);

  if (!config.backendAdminLogin || !config.backendAdminPassword) {
    reportMissingCredentials(mode, report);

    return { backendToken: null, mappings };
  }

  try {
    return { backendToken: await getBackendAdminToken(config), mappings };
  } catch (error) {
    pushWarning(report, { entityType: "import", message: error instanceof Error ? error.message : "Backend admin login failed", sourceKey: "world-data" });

    return { backendToken: null, mappings };
  }
}

export async function reconcileExistingBackend(
  config: BffConfig,
  state: ReconcileState,
  data: WorldData,
): Promise<void> {
  const token = state.backendToken;
  if (!token) {
    return;
  }

  const snapshot = await loadBackendSnapshot(config, token);
  const countryByIso = new Map(snapshot.countries.map((country) => [stringField(country, "iso"), country]));
  const regionByCode = new Map(snapshot.regions.map((region) => [stringField(region, "local_code"), region]));
  const airportByIcao = new Map(snapshot.airports.map((airport) => [stringField(airport, "icao_code"), airport]));

  for (const country of data.countries) {
    reconcileMapping(state, "country", country.sourceKey, country.payload, countryByIso.get(country.payload.iso));
  }
  for (const region of data.regions) {
    reconcileMapping(state, "region", region.sourceKey, region.payload, regionByCode.get(region.payload.local_code));
  }
  for (const airport of data.airports) {
    reconcileMapping(state, "airport", airport.sourceKey, airport.payload, airportByIcao.get(airport.payload.icao_code));
  }

  reconcileRegionLinks(state, snapshot.regionLinks);
}

function reconcileMapping(
  state: ReconcileState,
  entityType: EntityType,
  sourceKey: string,
  payload: unknown,
  backendEntity?: Record<string, unknown>,
): void {
  const id = backendEntity?.id;

  if (typeof id !== "string" || state.mappings.has(mappingKey(entityType, sourceKey))) {
    return;
  }

  state.mappings.set(mappingKey(entityType, sourceKey), createMapping(entityType, sourceKey, id, stableHash(payload)));
}

function reconcileRegionLinks(state: ReconcileState, links: Array<Record<string, unknown>>): void {
  const regionIdToCode = new Map([...state.mappings.values()].filter((item) => item.entityType === "region").map((item) => [item.backendId, item.sourceKey.replace("region:", "")]));

  for (const link of links) {
    const left = regionIdToCode.get(stringField(link, "region_a"));
    const right = regionIdToCode.get(stringField(link, "region_b"));
    if (!left || !right) {
      continue;
    }

    const sortedRegions = [left, right].sort();
    const sourceRegionA = sortedRegions[0] ?? left;
    const sourceRegionB = sortedRegions[1] ?? right;
    const sourceKey = `region-link:${sourceRegionA}:${sourceRegionB}`;
    const id = stringField(link, "id");
    if (id) {
      state.mappings.set(mappingKey("region-link", sourceKey), createMapping("region-link", sourceKey, id, "backend-reconciled"));
    }
  }
}

function reportMissingCredentials(mode: ImportMode, report: ImportReport): void {
  if (mode === "import") {
    pushError(report, { entityType: "import", message: "BFF backend admin credentials are not configured", sourceKey: "world-data" });
  } else {
    pushWarning(report, { entityType: "import", message: "Dry-run will not reconcile backend state without admin credentials", sourceKey: "world-data" });
  }
}
