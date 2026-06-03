import type { AircraftType, Airport } from "../fleet/types";
import type { RouteDemandSnapshot, RouteEconomics } from "./types";

export function buildRouteEconomics(
  demand: RouteDemandSnapshot,
  type: AircraftType | null,
  origin: Airport,
  destination: Airport,
): RouteEconomics {
  const seats = getAircraftSeats(type);
  const distance = demand.distance_km;
  const flightHours = getFlightHours(distance, type);
  const fare = Math.max(55, 38 + distance * 0.12);
  const loadFactor = clamp(demand.origin_daily_passengers / Math.max(seats, 1), 0.35, 0.95);
  const revenue = seats * loadFactor * fare;
  const cost = getFuelCost(type, flightHours) + getMaintenanceCost(type, flightHours) + getAirportCost(origin, destination);

  return {
    confidence: demand.region_link_id ? "high" : "medium",
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
  return (type?.fuel_consumption_per_hour ?? 2.8) * flightHours * 950;
}

function getMaintenanceCost(type: AircraftType | null, flightHours: number): number {
  return (type?.maint_cost_per_flight_hour ?? 600) * flightHours;
}
