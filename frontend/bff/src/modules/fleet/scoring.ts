import type {
  Aircraft,
  AircraftType,
  Airline,
  Airport,
  FleetAirportCard,
  FleetCompatibilityStatus,
  FleetMarketAircraftType,
  FleetOwnedAircraftCard,
  FleetReason,
} from "./types";

import { resolveAircraftImageUrl } from "../aircraft-images/resolve";
import { runwayConstraints } from "../facilities/constraints";

type CompatibilityFlags = {
  canAfford: boolean;
  canPurchase: boolean;
  canUseBase: boolean;
  cashReserveWarning: boolean;
  estimatedDailyMaintenanceReserve: number;
  hasPrice: boolean;
  hasRunwayData: boolean;
  price: number;
  recommendedReserve: number;
  remainingBalance: number;
};

const minimumReserve = 5_000_000;

export function enrichAircraftType(
  type: AircraftType,
  airline: Airline,
  baseAirport: Airport | undefined,
  ownedAircraftCount: number,
): FleetMarketAircraftType {
  const flags = getCompatibilityFlags(type, airline, baseAirport);
  const warnings = getCompatibilityWarnings(type, baseAirport, ownedAircraftCount, flags);
  const score = scoreAircraftType(type, warnings, flags);
  const status = getCompatibilityStatus(flags.canPurchase, flags.cashReserveWarning, warnings);

  return {
    ...type,
    compatibility: {
      canAfford: flags.canAfford,
      canPurchase: flags.canPurchase,
      canUseBase: flags.canUseBase,
      score,
      status,
      warnings,
    },
    image_url: resolveAircraftImageUrl(type),
    preview: {
      cashReserveWarning: flags.cashReserveWarning,
      estimatedDailyMaintenanceReserve: flags.estimatedDailyMaintenanceReserve,
      recommendedReserve: flags.recommendedReserve,
      remainingBalance: flags.remainingBalance,
    },
  };
}

export function enrichOwnedAircraft(
  aircraft: Aircraft,
  aircraftTypes: AircraftType[],
  airports: Airport[],
): FleetOwnedAircraftCard {
  const matchedType = aircraftTypes.find((item) => item.id === aircraft.type_id) ?? null;
  const type = matchedType ? { ...matchedType, image_url: resolveAircraftImageUrl(matchedType) } : null;
  const baseAirport = airports.find((item) => item.id === aircraft.base_airport_id);

  return {
    ...aircraft,
    assignment: {
      label: "Route assignment will appear after route planning.",
      status: "unassigned",
    },
    baseAirport: toAirportCard(baseAirport),
    baseAirportName: airportLabel(baseAirport),
    maintenanceRatio: maintenanceRatio(aircraft),
    modelName: type?.model_name ?? aircraft.type_id ?? "-",
    recommendedAction: {
      labelKey: "fleet.next.planRoute",
      route: "/airports/routes",
    },
    type,
  };
}

export function estimatedMaintenanceReserve(type: AircraftType): number {
  return (type.maint_cost_per_flight_hour ?? 0) * 8;
}

export function getRecommendedReserve(aircraftPrice: number, dailyMaintenanceReserve: number): number {
  return Math.max(minimumReserve, aircraftPrice * 0.1, dailyMaintenanceReserve * 14);
}

export function reason(code: FleetReason["code"], message: string): FleetReason {
  return { code, message };
}

export function toAirportCard(airport: Airport | undefined): FleetAirportCard | null {
  if (!airport) {
    return null;
  }

  return {
    gate_fee: airport.gate_fee ?? 0,
    iata_code: airport.iata_code,
    icao_code: airport.icao_code,
    id: airport.id,
    label: airportLabel(airport),
    maintenance_point_price: airport.maintenance_point_price ?? 0,
    max_runway_length_m: airport.max_runway_length_m ?? 0,
    max_runway_uses_per_day: airport.max_runway_uses_per_day ?? 0,
    municipality: airport.municipality,
    runway_fee: airport.runway_fee ?? 0,
    stand_fee: airport.stand_fee ?? 0,
    timezone: airport.timezone,
    turnaround_point_price: airport.turnaround_point_price ?? 0,
    works_at_night: airport.works_at_night !== false,
  };
}

function airportLabel(airport: Airport | undefined): string {
  if (!airport) {
    return "-";
  }

  return `${airport.iata_code ?? airport.icao_code ?? "----"} - ${airport.intl_name ?? airport.local_name ?? "Airport"}`;
}

function getBaseWarnings(baseAirport: Airport | undefined): FleetReason[] {
  const warnings: FleetReason[] = [];

  if (baseAirport?.works_at_night === false) {
    warnings.push(reason("FLEET_NO_NIGHT_OPS", "Base has limited night operations."));
  }

  if ((baseAirport?.max_runway_uses_per_day ?? 999) < 80) {
    warnings.push(reason("FLEET_LOW_SLOT_CAPACITY", "Base slot capacity is low."));
  }

  return warnings;
}

function getCanUseBase(
  baseAirport: Airport | undefined,
  type: AircraftType,
  hasRunwayData: boolean,
): boolean {
  return (
    Boolean(baseAirport) &&
    hasRunwayData &&
    (baseAirport?.max_runway_length_m ?? 0) >= (type.min_runway_length_m ?? 0)
  );
}

function getCompatibilityFlags(
  type: AircraftType,
  airline: Airline,
  baseAirport: Airport | undefined,
): CompatibilityFlags {
  const price = type.price_per_unit ?? 0;
  const balance = airline.balance ?? 0;
  const remainingBalance = balance - price;
  const estimatedDailyMaintenanceReserve = estimatedMaintenanceReserve(type);
  const recommendedReserve = getRecommendedReserve(price, estimatedDailyMaintenanceReserve);
  const hasPrice = price > 0;
  const hasRunwayData = Boolean(baseAirport?.max_runway_length_m && type.min_runway_length_m);
  const canAfford = hasPrice && balance >= price;
  const canUseBase = getCanUseBase(baseAirport, type, hasRunwayData);

  return {
    canAfford,
    canPurchase: canAfford && canUseBase && hasPrice,
    canUseBase,
    cashReserveWarning: canAfford && remainingBalance < recommendedReserve,
    estimatedDailyMaintenanceReserve,
    hasPrice,
    hasRunwayData,
    price,
    recommendedReserve,
    remainingBalance,
  };
}

function getCompatibilityStatus(
  canPurchase: boolean,
  cashReserveWarning: boolean,
  warnings: FleetReason[],
): FleetCompatibilityStatus {
  if (!canPurchase) {
    return "blocked";
  }

  if (cashReserveWarning || hasWarning(warnings, "FLEET_LARGE_AIRCRAFT_FIRST_PURCHASE")) {
    return "risky";
  }

  return warnings.length > 0 ? "available" : "recommended";
}

function getCompatibilityWarnings(
  type: AircraftType,
  baseAirport: Airport | undefined,
  ownedAircraftCount: number,
  flags: CompatibilityFlags,
): FleetReason[] {
  return [
    ...getPriceWarnings(flags),
    ...getRunwayWarnings(baseAirport, type),
    ...getBaseWarnings(baseAirport),
    ...getReserveWarnings(flags),
    ...getFirstAircraftWarnings(type, ownedAircraftCount, flags.price),
  ];
}

function getFirstAircraftWarnings(
  type: AircraftType,
  ownedAircraftCount: number,
  price: number,
): FleetReason[] {
  const isFirstAircraft = ownedAircraftCount === 0;
  const isLargeAircraft = (type.max_planned_seat_capacity ?? 0) > 260;
  const isVeryExpensive = price > 0 && price > minimumReserve * 15;

  return isFirstAircraft && (isLargeAircraft || isVeryExpensive)
    ? [reason("FLEET_LARGE_AIRCRAFT_FIRST_PURCHASE", "This is a large first aircraft for a new airline.")]
    : [];
}

function getPriceWarnings(flags: CompatibilityFlags): FleetReason[] {
  if (!flags.hasPrice) {
    return [reason("FLEET_MISSING_PRICE", "Aircraft price is missing.")];
  }

  if (!flags.canAfford) {
    return [reason("FLEET_INSUFFICIENT_FUNDS", "Balance is not enough for this aircraft.")];
  }

  return [];
}

function getReserveWarnings(flags: CompatibilityFlags): FleetReason[] {
  return flags.cashReserveWarning
    ? [reason("FLEET_RESERVE_RISK", "Remaining balance is below the recommended reserve.")]
    : [];
}

function getRunwayWarnings(baseAirport: Airport | undefined, type: AircraftType): FleetReason[] {
  if (!baseAirport) {
    return [reason("FLEET_BASE_AIRPORT_NOT_FOUND", "Base airport is missing.")];
  }

  return runwayConstraints(baseAirport, type).map((item) => reason(item.code, item.code));
}

function hasWarning(warnings: FleetReason[], code: FleetReason["code"]): boolean {
  return warnings.some((warning) => warning.code === code);
}

function maintenanceRatio(aircraft: Aircraft): number {
  const max = aircraft.max_maintenance_points_cached ?? 0;

  if (max <= 0) {
    return 1;
  }

  return Math.max(0, Math.min(1, (aircraft.current_maintenance_points ?? max) / max));
}

function scoreAircraftType(
  type: AircraftType,
  warnings: FleetReason[],
  flags: CompatibilityFlags,
): number {
  let score = flags.canPurchase ? 1000 : 0;
  score += scoreSeats(type.max_planned_seat_capacity);
  score += scoreRange(type.max_range_km);
  score += Math.max(0, 200 - (type.fuel_consumption_per_hour ?? 0) / 40);
  score += Math.max(0, 120 - (type.maint_cost_per_flight_hour ?? 0) / 120);
  score -= warnings.length * 90;

  if (flags.cashReserveWarning) {
    score -= 180;
  }

  return Math.round(score);
}

function scoreRange(range: number | undefined): number {
  const value = range ?? 0;

  return value >= 1500 && value <= 7000 ? 180 : 0;
}

function scoreSeats(seats: number | undefined): number {
  const value = seats ?? 0;

  if (value >= 70 && value <= 220) {
    return 220;
  }

  return value > 260 ? -180 : 0;
}
