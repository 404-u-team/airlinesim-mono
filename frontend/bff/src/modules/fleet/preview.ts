import type { Airport, FleetMarketAircraftType, FleetReason, FleetSnapshot } from "./types";

import { enrichAircraftType, reason, toAirportCard } from "./scoring";
import { getCountryForAirport } from "./snapshot";
import { validateTailNumber } from "./tail-number";

export type PurchasePreview = {
  aircraftPrice: number;
  aircraftType: FleetMarketAircraftType | null;
  airlineBalance: number;
  baseAirport: ReturnType<typeof toAirportCard>;
  blockingReasons: FleetReason[];
  canPurchase: boolean;
  estimatedDailyMaintenanceReserve: number;
  recommendedReserve: number;
  remainingBalance: number;
  tailNumber: ReturnType<typeof validateTailNumber>;
  warnings: FleetReason[];
};

const blockingWarningCodes = new Set<FleetReason["code"]>([
  "AIRPORT_DATA_INCOMPLETE",
  "AIRPORT_RUNWAY_TOO_SHORT",
  "FLEET_INSUFFICIENT_FUNDS",
  "FLEET_MISSING_PRICE",
  "FLEET_MISSING_RUNWAY_DATA",
  "FLEET_RUNWAY_TOO_SHORT",
]);

export function buildPurchasePreview(
  snapshot: FleetSnapshot,
  aircraftTypeId: string,
  baseAirportId: string,
  tailNumber: string,
): PurchasePreview {
  const aircraftType = snapshot.aircraftTypes.find((type) => type.id === aircraftTypeId);
  const baseAirport = snapshot.airports.find((airport) => airport.id === baseAirportId);
  const tail = validateTailNumber(tailNumber, snapshot.aircrafts, getCountryForAirport(snapshot, baseAirportId));
  const enrichedType = aircraftType
    ? enrichAircraftType(aircraftType, snapshot.airline, baseAirport, snapshot.aircrafts.length)
    : null;
  const blockingReasons = getBlockingReasons(Boolean(aircraftType), Boolean(baseAirport), tail, enrichedType);
  const warnings = getNonBlockingWarnings(enrichedType, blockingReasons);

  return getPurchasePreview(snapshot, enrichedType, baseAirport, blockingReasons, warnings, tail);
}

function getAircraftPrice(aircraftType: FleetMarketAircraftType | null): number {
  return aircraftType?.price_per_unit ?? 0;
}

function getAirlineBalance(snapshot: FleetSnapshot): number {
  return snapshot.airline.balance ?? 0;
}

function getBlockingReasons(
  hasAircraftType: boolean,
  hasBaseAirport: boolean,
  tail: ReturnType<typeof validateTailNumber>,
  enrichedType: FleetMarketAircraftType | null,
): FleetReason[] {
  return [
    ...getMissingEntityReasons(hasAircraftType, hasBaseAirport),
    ...getTailReasons(tail),
    ...getBlockingWarnings(enrichedType),
  ];
}

function getBlockingWarnings(enrichedType: FleetMarketAircraftType | null): FleetReason[] {
  return enrichedType?.compatibility.warnings.filter((warning) => blockingWarningCodes.has(warning.code)) ?? [];
}

function getEstimatedDailyMaintenanceReserve(aircraftType: FleetMarketAircraftType | null): number {
  return aircraftType?.preview.estimatedDailyMaintenanceReserve ?? 0;
}

function getMissingEntityReasons(hasAircraftType: boolean, hasBaseAirport: boolean): FleetReason[] {
  const reasons: FleetReason[] = [];

  if (!hasAircraftType) {
    reasons.push(reason("FLEET_AIRCRAFT_TYPE_NOT_FOUND", "Aircraft type not found."));
  }

  if (!hasBaseAirport) {
    reasons.push(reason("FLEET_BASE_AIRPORT_NOT_FOUND", "Base airport not found."));
  }

  return reasons;
}

function getNonBlockingWarnings(
  enrichedType: FleetMarketAircraftType | null,
  blockingReasons: FleetReason[],
): FleetReason[] {
  const blockingCodes = new Set(blockingReasons.map((item) => item.code));

  return enrichedType?.compatibility.warnings.filter((warning) => !blockingCodes.has(warning.code)) ?? [];
}

function getPurchasePreview(
  snapshot: FleetSnapshot,
  aircraftType: FleetMarketAircraftType | null,
  baseAirport: Airport | undefined,
  blockingReasons: FleetReason[],
  warnings: FleetReason[],
  tailNumber: ReturnType<typeof validateTailNumber>,
): PurchasePreview {
  return {
    aircraftPrice: getAircraftPrice(aircraftType),
    aircraftType,
    airlineBalance: getAirlineBalance(snapshot),
    baseAirport: toAirportCard(baseAirport),
    blockingReasons,
    canPurchase: blockingReasons.length === 0 && Boolean(aircraftType?.compatibility.canPurchase),
    estimatedDailyMaintenanceReserve: getEstimatedDailyMaintenanceReserve(aircraftType),
    recommendedReserve: getRecommendedReserve(aircraftType),
    remainingBalance: getRemainingBalance(snapshot, aircraftType),
    tailNumber,
    warnings,
  };
}

function getRecommendedReserve(aircraftType: FleetMarketAircraftType | null): number {
  return aircraftType?.preview.recommendedReserve ?? 0;
}

function getRemainingBalance(snapshot: FleetSnapshot, aircraftType: FleetMarketAircraftType | null): number {
  return aircraftType?.preview.remainingBalance ?? getAirlineBalance(snapshot);
}

function getTailReasons(tail: ReturnType<typeof validateTailNumber>): FleetReason[] {
  if (tail.valid) {
    return [];
  }

  const code = tail.conflict ? "FLEET_TAIL_NUMBER_EXISTS" : "FLEET_TAIL_NUMBER_INVALID";

  return [reason(code, tail.message ?? "Invalid tail number.")];
}
