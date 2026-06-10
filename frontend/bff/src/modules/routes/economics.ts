import type { AircraftType, Airport } from "../fleet/types";
import type { RouteDemandSnapshot, RouteEconomics } from "./types";

import { getCurrentFuelUnitPrice } from "../fuel/price";
import { MAX_LOAD_FACTOR, referenceFare } from "../operations/passenger-load";

export function buildRouteEconomics(
  demand: RouteDemandSnapshot,
  type: AircraftType | null,
  origin: Airport,
  destination: Airport,
): RouteEconomics {
  const seats = getAircraftSeats(type);
  const distance = demand.distance_km;
  const flightHours = getFlightHours(distance, type);
  const fare = referenceFare(distance);
  const loadFactor = clamp(demand.origin_daily_passengers / Math.max(seats, 1), 0, MAX_LOAD_FACTOR);
  const revenue = seats * loadFactor * fare;
  const cost = getFuelCost(type, flightHours) + getMaintenanceCost(type, flightHours) + getAirportCost(origin, destination);

  return {
    // High confidence once demand uses real catchment data (post-import artifact);
    // medium while falling back to admin1 region population.
    confidence: demand.breakdown?.catchmentSource === "artifact" ? "high" : "medium",
    estimated_cost_per_flight: Math.round(cost),
    estimated_fare_per_passenger: Math.round(fare),
    estimated_profit_per_flight: Math.round(revenue - cost),
    estimated_revenue_per_flight: Math.round(revenue),
    expected_load_factor: Number(loadFactor.toFixed(2)),
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function getAircraftSeats(type: AircraftType | null): number {
  return type?.max_planned_seat_capacity ?? 120;
}

function getAirportCost(origin: Airport, destination: Airport): number {
  return (origin.runway_fee ?? 0) + (origin.gate_fee ?? 0) + (destination.runway_fee ?? 0) + (destination.stand_fee ?? 0);
}

function getFlightHours(distance: number, type: AircraftType | null): number {
  return Math.max(0.5, distance / (type?.cruising_speed_kph ?? 750));
}

function getFuelCost(type: AircraftType | null, flightHours: number): number {
  // fuel_consumption_per_hour is kg/h; the fuel unit price is per tonne, so convert.
  return ((type?.fuel_consumption_per_hour ?? 2000) / 1000) * flightHours * getCurrentFuelUnitPrice();
}

function getMaintenanceCost(type: AircraftType | null, flightHours: number): number {
  return (type?.maint_cost_per_flight_hour ?? 600) * flightHours;
}
