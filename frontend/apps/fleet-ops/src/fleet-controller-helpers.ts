import type { FleetOwnedAircraftCard } from "./types";

export function getAircraftStatus(aircraft: FleetOwnedAircraftCard): string {
  if (aircraft.maintenanceRatio < 0.35) {
    return "maintenance";
  }
  if (aircraft.in_service) {
    return "in_service";
  }

  return aircraft.assignment.status;
}

export function getProgressBarTone(ratio: number): "danger" | "neutral" | "primary" | "success" | "warning" {
  if (ratio < 0.35) {
    return "danger";
  }
  if (ratio < 0.75) {
    return "warning";
  }
  return "success";
}

export function getSortValue(aircraft: FleetOwnedAircraftCard, field: string): number | string {
  switch (field) {
    case "cycles":
       
      return aircraft.total_cycles ?? 0;
    case "hours":
       
      return aircraft.total_flight_hours ?? 0;
    case "maintenance":
      return aircraft.maintenanceRatio;
    case "model":
      return aircraft.modelName;
    default:
       
      return aircraft.tail_number ?? aircraft.id ?? "";
  }
}

export function statusLabel(aircraft: FleetOwnedAircraftCard, t: (key: string) => string): string {
  const aircraftStatus = getAircraftStatus(aircraft);
  const key = `fleet.filter.status.${aircraftStatus === "in_service" ? "inService" : aircraftStatus}`;

  return t(key);
}

export function statusVariant(aircraft: FleetOwnedAircraftCard): "primary-soft" | "success-soft" | "warning-soft" {
  const aircraftStatus = getAircraftStatus(aircraft);
  if (aircraftStatus === "maintenance") {
    return "warning-soft";
  }
  if (aircraftStatus === "in_service") {
    return "success-soft";
  }

  return "primary-soft";
}
