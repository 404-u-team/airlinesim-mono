import type { BffConfig } from "../../../config";
import type { EntityType, ImportMode, ImportReport, WorldData } from "../shared/types";
import type { ImportLogger } from "./logger";

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
  log?: ImportLogger,
): Promise<void> {
  const token = state.backendToken;
  if (!token) {
    return;
  }

  const snapshot = await loadBackendSnapshot(config, token, log);
  const countryByIso = new Map(snapshot.countries.map((country) => [stringField(country, "iso"), country]));
  const regionByCode = new Map(snapshot.regions.map((region) => [stringField(region, "local_code"), region]));
  const airportByIcao = new Map(snapshot.airports.map((airport) => [stringField(airport, "icao_code"), airport]));
  const aircraftTypeByIcao = new Map(snapshot.aircraftTypes.map((aircraftType) => [stringField(aircraftType, "icao_code"), aircraftType]));

  for (const aircraftType of data.aircraftTypes) {
    reconcileMapping(state, "aircraft-type", aircraftType.sourceKey, aircraftType.payload, aircraftTypeByIcao.get(aircraftType.payload.icao_code));
  }

  for (const country of data.countries) {
    reconcileMapping(state, "country", country.sourceKey, country.payload, countryByIso.get(country.payload.iso));
  }
  for (const region of data.regions) {
    reconcileMapping(state, "region", region.sourceKey, region.payload, regionByCode.get(region.payload.local_code));
  }
  for (const airport of data.airports) {
    reconcileMapping(state, "airport", airport.sourceKey, airport.payload, airportByIcao.get(airport.payload.icao_code));
  }
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

function reportMissingCredentials(mode: ImportMode, report: ImportReport): void {
  if (mode === "import") {
    pushError(report, { entityType: "import", message: "BFF backend admin credentials are not configured", sourceKey: "world-data" });
  } else {
    pushWarning(report, { entityType: "import", message: "Dry-run will not reconcile backend state without admin credentials", sourceKey: "world-data" });
  }
}
