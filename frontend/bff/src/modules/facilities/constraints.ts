import type { Aircraft, AircraftType, Airport } from "../fleet/types";
import type { AirportConstraint } from "./types";

export const NIGHT_WINDOW = "23:00-06:00";

export function aircraftStateConstraints(aircraft: Aircraft): AirportConstraint[] {
  const constraints: AirportConstraint[] = [];

  if (aircraft.status === "maintenance" || aircraft.in_service === false) {
    constraints.push(constraint("AIRCRAFT_NOT_READY", true, {
      aircraft_id: aircraft.id ?? "",
    }, "/fleet/aircraft", {
      aircraft_id: aircraft.id,
    }));
  }

  if (maintenanceRatio(aircraft) < 0.35) {
    constraints.push(constraint("AIRCRAFT_MAINTENANCE_LOW", false, {
      aircraft_id: aircraft.id ?? "",
      maintenance_ratio: maintenanceRatio(aircraft),
    }, "/fleet/maintenance", {
      aircraft_id: aircraft.id,
    }));
  }

  return constraints;
}

export function airportDataConstraints(airport: Airport | undefined): AirportConstraint[] {
  if (!airport) {
    return [constraint("AIRPORT_DATA_INCOMPLETE", true, {}, "/staff/overview")];
  }

  const constraints: AirportConstraint[] = [];

  if (!positive(airport.max_runway_length_m) || !positive(airport.max_runway_uses_per_day)) {
    constraints.push(constraint("AIRPORT_DATA_INCOMPLETE", true, {
      airport_id: airport.id ?? "",
    }, "/staff/overview", {
      airport_id: airport.id,
    }));
  }

  if (!validTimeZone(airport.timezone)) {
    constraints.push(constraint("AIRPORT_TIMEZONE_MISSING", false, {
      airport_id: airport.id ?? "",
    }, "/staff/overview", {
      airport_id: airport.id,
    }));
  }

  return constraints;
}

export function arrivalLocalDayOffset(
  departureLocalTime: string,
  blockHours: number,
  originTimeZone: string | undefined,
  destinationTimeZone: string | undefined,
): number {
  return arrivalLocalDetails(departureLocalTime, blockHours, originTimeZone, destinationTimeZone)?.dayOffset ?? 0;
}

export function arrivalLocalTime(
  departureLocalTime: string,
  blockHours: number,
  originTimeZone: string | undefined,
  destinationTimeZone: string | undefined,
): null | string {
  return arrivalLocalDetails(departureLocalTime, blockHours, originTimeZone, destinationTimeZone)?.time ?? null;
}

export function constraint(
  code: AirportConstraint["code"],
  blocking: boolean,
  parameters: AirportConstraint["parameters"],
  targetPath: string,
  affected: AirportConstraint["affected"] = {},
): AirportConstraint {
  return {
    affected,
    blocking,
    code,
    parameters,
    severity: blocking ? "danger" : "warning",
    target_path: targetPath,
  };
}

export function isNightLocalTime(time: string): boolean {
  const [hour = 0, minute = 0] = time.split(":").map(Number);
  const minutes = hour * 60 + minute;

  return minutes >= 23 * 60 || minutes < 6 * 60;
}

export function nightOperationConstraints(
  airport: Airport | undefined,
  localTime: string,
  targetPath = "/operations/schedule",
): AirportConstraint[] {
  const constraints = airportDataConstraints(airport).filter((item) => item.code === "AIRPORT_TIMEZONE_MISSING");

  if (airport?.works_at_night === false && isNightLocalTime(localTime)) {
    constraints.push(constraint("AIRPORT_NIGHT_OPS_PROHIBITED", true, {
      airport_id: airport.id ?? "",
      local_time: localTime,
      night_window: NIGHT_WINDOW,
    }, targetPath, {
      airport_id: airport.id,
    }));
  }

  return constraints;
}

export function rangeConstraints(
  distanceKm: number | undefined,
  type: AircraftType | null | undefined,
  targetPath = "/fleet/aircraft",
): AirportConstraint[] {
  if (!type || !positive(type.max_range_km) || !positive(distanceKm)) {
    return [];
  }

  const margin = (type.max_range_km ?? 0) - (distanceKm ?? 0);

  return margin < 0
    ? [constraint("AIRCRAFT_RANGE_TOO_SHORT", true, {
      aircraft_type_id: type.id ?? "",
      distance_km: distanceKm ?? 0,
      range_km: type.max_range_km ?? 0,
      range_margin_km: margin,
    }, targetPath, {
      aircraft_type_id: type.id,
    })]
    : [];
}

export function runwayConstraints(
  airport: Airport | undefined,
  type: AircraftType | null | undefined,
  targetPath = "/staff/overview",
): AirportConstraint[] {
  const details = runwayDetails(airport, type);

  if (!details) {
    return [constraint("AIRPORT_DATA_INCOMPLETE", true, {
      aircraft_type_id: type?.id ?? "",
      airport_id: airport?.id ?? "",
    }, targetPath, {
      aircraft_type_id: type?.id,
      airport_id: airport?.id,
    })];
  }

  return details.margin < 0
    ? [constraint("AIRPORT_RUNWAY_TOO_SHORT", true, {
      aircraft_type_id: details.aircraftTypeId,
      airport_id: details.airportId,
      available_runway_m: details.available,
      required_runway_m: details.required,
      runway_margin_m: details.margin,
    }, targetPath, {
      aircraft_type_id: details.aircraftTypeId,
      airport_id: details.airportId,
    })]
    : [];
}

export function runwayMargin(airport: Airport | undefined, type: AircraftType | null | undefined): null | number {
  return runwayDetails(airport, type)?.margin ?? null;
}

export function timeInZone(date: Date, timeZone: string | undefined): null | string {
  if (!validTimeZone(timeZone)) {
    return null;
  }

  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
    timeZone,
  }).format(date);
}

export function validTimeZone(timeZone: string | undefined): timeZone is string {
  if (!timeZone) {
    return false;
  }

  try {
    new Intl.DateTimeFormat("en", { timeZone }).format();
    return true;
  } catch {
    return false;
  }
}

function airportId(airport: Airport | undefined): string {
  return airport?.id ?? "";
}

function airportRunway(airport: Airport | undefined): number {
  return airport?.max_runway_length_m ?? 0;
}

function arrivalLocalDetails(
  departureLocalTime: string,
  blockHours: number,
  originTimeZone: string | undefined,
  destinationTimeZone: string | undefined,
): null | { dayOffset: number; time: string } {
  if (!validTimeZone(originTimeZone) || !validTimeZone(destinationTimeZone)) {
    return null;
  }

  const [hour = 0, minute = 0] = departureLocalTime.split(":").map(Number);
  const localReference = Date.UTC(2026, 5, 1, hour, minute);
  const departureUtc = new Date(localReference - timeZoneOffsetMs(new Date(localReference), originTimeZone));
  const arrivalUtc = new Date(departureUtc.getTime() + blockHours * 60 * 60_000);
  const destinationParts = datePartsInZone(arrivalUtc, destinationTimeZone);
  const destinationDate = Date.UTC(destinationParts.year, destinationParts.month - 1, destinationParts.day);

  return {
    dayOffset: Math.round((destinationDate - Date.UTC(2026, 5, 1)) / (24 * 60 * 60_000)),
    time: timeInZone(arrivalUtc, destinationTimeZone) ?? "00:00",
  };
}

function datePartsInZone(date: Date, timeZone: string, includeTime = false): {
  day: number;
  hour?: number;
  minute?: number;
  month: number;
  second?: number;
  year: number;
} {
  const parts = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    ...(includeTime ? { hour: "2-digit", hour12: false, minute: "2-digit", second: "2-digit" } : {}),
    month: "2-digit",
    timeZone,
    year: "numeric",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return {
    day: Number(values.day),
    hour: includeTime ? Number(values.hour) % 24 : undefined,
    minute: includeTime ? Number(values.minute) : undefined,
    month: Number(values.month),
    second: includeTime ? Number(values.second) : undefined,
    year: Number(values.year),
  };
}

function maintenanceRatio(aircraft: Aircraft): number {
  const max = aircraft.max_maintenance_points_cached ?? 0;

  return max > 0 ? Math.max(0, Math.min(1, (aircraft.current_maintenance_points ?? max) / max)) : 1;
}

function positive(value: number | undefined): boolean {
  return typeof value === "number" && value > 0;
}

function requiredRunway(type: AircraftType | null | undefined): number {
  return type?.min_runway_length_m ?? 0;
}

function runwayDetails(
  airport: Airport | undefined,
  type: AircraftType | null | undefined,
): null | {
  aircraftTypeId: string;
  airportId: string;
  available: number;
  margin: number;
  required: number;
} {
  const available = airportRunway(airport);
  const required = requiredRunway(type);

  if (!positive(available) || !positive(required)) {
    return null;
  }

  return {
    aircraftTypeId: typeId(type),
    airportId: airportId(airport),
    available,
    margin: available - required,
    required,
  };
}

function timeZoneOffsetMs(date: Date, timeZone: string): number {
  const values = datePartsInZone(date, timeZone, true);
  const asUtc = Date.UTC(
    values.year,
    values.month - 1,
    values.day,
    values.hour ?? 0,
    values.minute ?? 0,
    values.second ?? 0,
  );

  return asUtc - date.getTime();
}

function typeId(type: AircraftType | null | undefined): string {
  return type?.id ?? "";
}
