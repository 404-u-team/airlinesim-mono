import type { Aircraft, AircraftType, Airport } from "../fleet/types";

export type AircraftCompatibilitySummary = {
  aircraft: Aircraft;
  compatible: boolean;
  constraints: AirportConstraint[];
  runway_margin_m: null | number;
  type: AircraftType | null;
};

export type AirportConstraint = {
  affected: {
    aircraft_id?: string;
    aircraft_type_id?: string;
    airport_id?: string;
    route_id?: string;
  };
  blocking: boolean;
  code: AirportConstraintCode;
  parameters: Record<string, boolean | number | string>;
  severity: "danger" | "warning";
  target_path: string;
};

export type AirportConstraintCode =
  | "AIRCRAFT_MAINTENANCE_LOW"
  | "AIRCRAFT_NOT_READY"
  | "AIRCRAFT_RANGE_TOO_SHORT"
  | "AIRPORT_DATA_INCOMPLETE"
  | "AIRPORT_NIGHT_OPS_PROHIBITED"
  | "AIRPORT_RUNWAY_TOO_SHORT"
  | "AIRPORT_SLOT_CAPACITY_EXCEEDED"
  | "AIRPORT_SLOT_CAPACITY_LOW"
  | "AIRPORT_TIMEZONE_MISSING";

export type AirportCostProfile = {
  estimated_cost_per_operation: number;
  fuel_price_multiplier: number;
  gate_fee: number;
  maintenance_point_price: number;
  runway_fee: number;
  stand_fee: number;
  turnaround_point_price: number;
};

export type AirportSummary = Airport & {
  label: string;
};

export type BaseFacilitiesOverview = {
  aircraft_compatibility: AircraftCompatibilitySummary[];
  base_airport: AirportSummary | null;
  constraints: AirportConstraint[];
  costs: AirportCostProfile;
  next_actions: Array<{
    code: string;
    target_path: string;
  }>;
  night_operations: {
    affected_schedules: number;
    enabled: boolean;
    night_window: string;
  };
  runway: {
    compatible_owned_aircraft: number;
    incompatible_owned_aircraft: number;
    max_length_m: number;
  };
  slots: SlotCapacitySummary;
  status: "blocked" | "missing" | "ready" | "warning";
};

export type SlotCapacityDay = {
  capacity: number;
  current: number;
  day: number;
  projected: number;
  remaining: number;
  utilization: number;
};

export type SlotCapacitySummary = {
  busiest_day: number;
  capacity_per_day: number;
  days: SlotCapacityDay[];
  model: "airline_planning_headroom";
  planned_uses_by_day: Record<string, number>;
  remaining_by_day: Record<string, number>;
  utilization_by_day: Record<string, number>;
};

