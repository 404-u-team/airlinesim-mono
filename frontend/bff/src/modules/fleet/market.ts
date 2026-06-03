import type { BffConfig } from "../../config";
import type { FleetMarketAircraftType } from "./types";

import { enrichAircraftType, enrichOwnedAircraft, toAirportCard } from "./scoring";
import { loadFleetSnapshot } from "./snapshot";

type MarketFilters = {
  maxPrice?: number;
  minCapacity?: number;
  minRange?: number;
  q?: string;
  sort: string;
};

export async function getFleetMarket(request: Request, url: URL, config: BffConfig): Promise<Record<string, unknown>> {
  const snapshot = await loadFleetSnapshot(request, config);
  const filters = parseMarketFilters(url);
  const baseAirport =
    snapshot.airports.find((airport) => airport.id === url.searchParams.get("base_airport_id")) ??
    snapshot.airports.find((airport) => airport.id === snapshot.airline.starting_airport_id);
  const aircraftTypes = snapshot.aircraftTypes
    .map((type) => enrichAircraftType(type, snapshot.airline, baseAirport, snapshot.aircrafts.length))
    .filter((type) => matchesFilters(type, filters))
    .sort((left, right) => compareTypes(left, right, filters.sort));
  const ownedAircraft = snapshot.aircrafts.map((aircraft) =>
    enrichOwnedAircraft(aircraft, snapshot.aircraftTypes, snapshot.airports),
  );

  return {
    aircraftTypes,
    airline: {
      balance: snapshot.airline.balance ?? 0,
      id: snapshot.airline.id,
      name: snapshot.airline.name,
      starting_airport_id: snapshot.airline.starting_airport_id,
    },
    baseAirport: toAirportCard(baseAirport),
    filters,
    ownedAircraft,
    summary: getMarketSummary(aircraftTypes, snapshot.aircraftTypes.length),
  };
}

function compareTypes(left: FleetMarketAircraftType, right: FleetMarketAircraftType, sort: string): number {
  if (sort === "price") {
    return (left.price_per_unit ?? 0) - (right.price_per_unit ?? 0);
  }
  if (sort === "capacity") {
    return (right.max_planned_seat_capacity ?? 0) - (left.max_planned_seat_capacity ?? 0);
  }
  if (sort === "range") {
    return (right.max_range_km ?? 0) - (left.max_range_km ?? 0);
  }

  return right.compatibility.score - left.compatibility.score;
}

function getMarketSummary(aircraftTypes: FleetMarketAircraftType[], totalTypes: number): Record<string, unknown> {
  return {
    affordableTypes: aircraftTypes.filter((type) => type.compatibility.canAfford).length,
    baseCompatibleTypes: aircraftTypes.filter((type) => type.compatibility.canUseBase).length,
    recommendedTypeId: aircraftTypes.find((type) => type.compatibility.status === "recommended")?.id,
    totalTypes,
    visibleTypes: aircraftTypes.length,
  };
}

function matchesFilters(type: FleetMarketAircraftType, filters: MarketFilters): boolean {
  return (
    matchesQuery(type, filters.q) &&
    (type.max_range_km ?? 0) >= (filters.minRange ?? 0) &&
    (type.max_planned_seat_capacity ?? 0) >= (filters.minCapacity ?? 0) &&
    (type.price_per_unit ?? 0) <= (filters.maxPrice ?? Number.POSITIVE_INFINITY)
  );
}

function matchesQuery(type: FleetMarketAircraftType, query: string | undefined): boolean {
  if (!query) {
    return true;
  }

  const text = `${type.model_name ?? ""} ${type.iata_code ?? ""} ${type.icao_code ?? ""}`.toLowerCase();

  return text.includes(query.toLowerCase());
}

function optionalNumber(value: null | string): number | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : undefined;
}

function optionalString(value: null | string): string | undefined {
  const trimmed = value?.trim();

  if (!trimmed) {
    return undefined;
  }

  return trimmed;
}

function parseMarketFilters(url: URL): MarketFilters {
  return {
    maxPrice: optionalNumber(url.searchParams.get("max_price")),
    minCapacity: optionalNumber(url.searchParams.get("min_capacity")),
    minRange: optionalNumber(url.searchParams.get("min_range")),
    q: optionalString(url.searchParams.get("q")),
    sort: url.searchParams.get("sort") ?? "recommended",
  };
}
