import { airlineSimEventBus } from "@airlinesim/event-bus";

import type { FleetMessageKey } from "./i18n";
import type { FleetMarketResponse, FleetOwnedAircraftCard } from "./types";

export function emitAircraftPurchased(aircraft: FleetOwnedAircraftCard, price: number): void {
  airlineSimEventBus.emit("fleet:aircraft-purchased", {
    aircraftId: aircraft.id,
    baseAirportId: aircraft.base_airport_id,
    modelName: aircraft.modelName,
    price,
    tailNumber: aircraft.tail_number,
    typeId: aircraft.type_id,
  });
}

export function emitFleetInvalidations(message: string): void {
  airlineSimEventBus.emit("game:snapshot-invalidated", {
    reason: "aircraft-purchased",
    source: "fleet-ops",
  });
  airlineSimEventBus.emit("events:invalidated", { reason: "aircraft-purchased", source: "fleet-ops" });
  airlineSimEventBus.emit("notifications:invalidated", { reason: "aircraft-purchased", source: "fleet-ops" });
  airlineSimEventBus.emit("map:network-refresh-requested", {
    reason: "aircraft-purchased",
    source: "fleet-ops",
  });
  airlineSimEventBus.emit("notification:created", {
    message,
    severity: "success",
  });
}

export function getFleetErrorMessage(
  value: unknown,
  fallback: FleetMessageKey,
  t: (key: string) => string,
): string {
  const errorPayload = getErrorPayload(value);

  if (errorPayload?.code) {
    const key = `warning.${errorPayload.code}` as FleetMessageKey;

    return t(key);
  }

  return errorPayload?.message ?? t(fallback);
}

export function getNextSelectedTypeId(response: FleetMarketResponse, selectedTypeId: string): string {
  const currentTypeAvailable = response.aircraftTypes.some((type) => type.id === selectedTypeId);

  return currentTypeAvailable
    ? selectedTypeId
    : response.summary.recommendedTypeId ?? response.aircraftTypes[0]?.id ?? "";
}

function getErrorPayload(value: unknown): null | { code?: string; message?: string } {
  if (!value || typeof value !== "object") {
    return null;
  }

  const { data } = value as { data?: unknown };
  if (!data || typeof data !== "object") {
    return null;
  }

  const { error: payload } = data as { error?: { code?: string; message?: string } };

  return payload ?? null;
}
