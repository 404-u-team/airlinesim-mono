import type { ValidatorMap } from "../core";
import type { AirlineSimEvents, NavigationChangedEvent, NavigationIntentEvent, RemoteId } from "./types";

export const remoteIds = new Set<RemoteId>([
  "events-news",
  "finance-stock",
  "fleet-ops",
  "hr-facilities",
  "map",
  "network-planner",
]);

export const airlineSimEventValidators: ValidatorMap<AirlineSimEvents> = {
  "auth:login-failed": hasString("message"),
  "auth:login-succeeded": hasString("accessToken"),
  "auth:logout": (payload): payload is AirlineSimEvents["auth:logout"] =>
    isRecord(payload) && isOneOf(payload.reason, ["expired", "manual"]),
  "auth:register-failed": hasString("message"),
  "auth:register-succeeded": hasString("accessToken"),
  "auth:session-restored": hasString("accessToken"),
  "fleet:aircraft-purchased": (payload): payload is AirlineSimEvents["fleet:aircraft-purchased"] =>
    isRecord(payload) &&
    hasOptionalStringValue(payload, "aircraftId") &&
    hasOptionalStringValue(payload, "baseAirportId") &&
    hasOptionalStringValue(payload, "modelName") &&
    hasOptionalNumberValue(payload, "price") &&
    hasOptionalStringValue(payload, "tailNumber") &&
    hasOptionalStringValue(payload, "typeId"),
  "flight:selected": (payload): payload is AirlineSimEvents["flight:selected"] =>
    isRecord(payload) &&
    typeof payload.flightId === "string" &&
    isOneOf(payload.source, ["fleet-ops", "map", "shell"]),
  "game:snapshot-invalidated": (payload): payload is AirlineSimEvents["game:snapshot-invalidated"] =>
    isRecord(payload) &&
    isOneOf(payload.reason, ["aircraft-purchased", "manual-refresh"]) &&
    isOneOf(payload.source, ["fleet-ops", "shell"]),
  "i18n:locale-changed": (payload): payload is AirlineSimEvents["i18n:locale-changed"] =>
    isRecord(payload) && isOneOf(payload.locale, ["en", "ru"]),
  "map:airport-selected": (payload): payload is AirlineSimEvents["map:airport-selected"] =>
    isRecord(payload) &&
    typeof payload.airportId === "string" &&
    isOneOf(payload.source, ["dashboard", "map", "network-planner"]),
  "map:network-refresh-requested": (payload): payload is AirlineSimEvents["map:network-refresh-requested"] =>
    isRecord(payload) &&
    isOneOf(payload.reason, ["aircraft-purchased", "manual-refresh"]) &&
    isOneOf(payload.source, ["fleet-ops", "shell"]),
  "map:route-selected": (payload): payload is AirlineSimEvents["map:route-selected"] =>
    isRecord(payload) &&
    typeof payload.routeId === "string" &&
    isOneOf(payload.source, ["dashboard", "map", "network-planner"]),
  "mfe:ready": hasRemoteId,
  "navigation:changed": (payload): payload is NavigationChangedEvent =>
    isRecord(payload) &&
    typeof payload.navigationId === "string" &&
    typeof payload.path === "string" &&
    typeof payload.remoteId === "string" &&
    remoteIds.has(payload.remoteId as RemoteId) &&
    (payload.fromPath === undefined || typeof payload.fromPath === "string"),
  "navigation:intent": (payload): payload is NavigationIntentEvent =>
    isRecord(payload) &&
    typeof payload.targetPath === "string" &&
    isOneOf(payload.source, ["mfe", "shell"]) &&
    (payload.replace === undefined || typeof payload.replace === "boolean"),
  "navigation:remote-selected": (payload): payload is AirlineSimEvents["navigation:remote-selected"] =>
    isRecord(payload) &&
    typeof payload.remoteId === "string" &&
    remoteIds.has(payload.remoteId as RemoteId) &&
    (payload.path === undefined || typeof payload.path === "string"),
  "notification:created": (payload): payload is AirlineSimEvents["notification:created"] =>
    isRecord(payload) &&
    typeof payload.message === "string" &&
    isOneOf(payload.severity, ["error", "info", "success", "warning"]),
  "shell:panel-requested": (payload): payload is AirlineSimEvents["shell:panel-requested"] =>
    isRecord(payload) && isOneOf(payload.panel, ["flight-details", "notifications", "profile"]),
};

function hasOptionalNumberValue(record: Record<string, unknown>, key: string): boolean {
  return record[key] === undefined || typeof record[key] === "number";
}

function hasOptionalStringValue(record: Record<string, unknown>, key: string): boolean {
  return record[key] === undefined || typeof record[key] === "string";
}

function hasRemoteId(payload: unknown): payload is { remoteId: RemoteId } {
  return (
    isRecord(payload) &&
    typeof payload.remoteId === "string" &&
    remoteIds.has(payload.remoteId as RemoteId)
  );
}

function hasString<TPayload extends Record<string, unknown>>(key: keyof TPayload & string) {
  return (payload: unknown): payload is TPayload =>
    isRecord(payload) && typeof payload[key] === "string";
}

function isOneOf<const TValue extends string>(
  value: unknown,
  allowedValues: readonly TValue[],
): value is TValue {
  return typeof value === "string" && allowedValues.includes(value as TValue);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
