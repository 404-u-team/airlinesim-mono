import type { EntityType, ImportMapping } from "../shared/types";

export type ReconcileState = {
  backendToken: null | string;
  mappings: Map<string, ImportMapping>;
};

export function camelPlural(entityType: EntityType): string {
  if (entityType === "aircraft-type") {
    return "aircraftTypes";
  }
  if (entityType === "country") {
    return "countries";
  }
  if (entityType === "region-link") {
    return "regionLinks";
  }

  return `${entityType}s`;
}

export function createMapping(
  entityType: EntityType,
  sourceKey: string,
  backendId: string,
  payloadHash: string,
): ImportMapping {
  return {
    backendId,
    entityType,
    importedAt: new Date().toISOString(),
    payloadHash,
    sourceKey,
  };
}

export function getMappedId(state: ReconcileState, entityType: EntityType, sourceKey: string): null | string {
  return state.mappings.get(`${entityType}:${sourceKey}`)?.backendId ?? null;
}

export function stringField(record: Record<string, unknown>, key: string): string {
  const value = record[key];

  return typeof value === "string" ? value : "";
}
