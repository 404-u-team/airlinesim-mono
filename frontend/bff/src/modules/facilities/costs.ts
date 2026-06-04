import type { Airport } from "../fleet/types";
import type { AirportCostProfile } from "./types";

export function airportCostProfile(airport: Airport | undefined): AirportCostProfile {
  const runwayFee = value(airport?.runway_fee);
  const gateFee = value(airport?.gate_fee);
  const standFee = value(airport?.stand_fee);
  const turnaroundPointPrice = value(airport?.turnaround_point_price);

  return {
    estimated_cost_per_operation: runwayFee + gateFee + standFee + turnaroundPointPrice,
    fuel_price_multiplier: value(airport?.fuel_price_multiplier, 1),
    gate_fee: gateFee,
    maintenance_point_price: value(airport?.maintenance_point_price),
    runway_fee: runwayFee,
    stand_fee: standFee,
    turnaround_point_price: turnaroundPointPrice,
  };
}

function value(input: number | undefined, fallback = 0): number {
  return input ?? fallback;
}
