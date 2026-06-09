export type Constraint = {
  blocking: boolean;
  code: ConstraintCode;
  parameters: Record<string, boolean | number | string>;
  target_path: string;
};

export type ConstraintCode =
  | "AIRCRAFT_MAINTENANCE_LOW"
  | "AIRCRAFT_NOT_READY"
  | "AIRCRAFT_RANGE_TOO_SHORT"
  | "AIRPORT_DATA_INCOMPLETE"
  | "AIRPORT_NIGHT_OPS_PROHIBITED"
  | "AIRPORT_RUNWAY_TOO_SHORT"
  | "AIRPORT_SLOT_CAPACITY_EXCEEDED"
  | "AIRPORT_SLOT_CAPACITY_LOW"
  | "AIRPORT_TIMEZONE_MISSING";

export type FacilitiesOverview = {
  aircraft_compatibility: Array<{
    aircraft: {
      id?: string;
      tail_number?: string;
    };
    compatible: boolean;
    constraints: Constraint[];
    runway_margin_m: null | number;
    type: null | {
      icao_code?: string;
      image_url?: string;
      min_runway_length_m?: number;
      model_name?: string;
    };
  }>;
  base_airport: null | {
    iata_code?: string;
    icao_code?: string;
    label: string;
    municipality?: string;
    timezone?: string;
  };
  constraints: Constraint[];
  costs: {
    estimated_cost_per_operation: number;
    fuel_price_multiplier: number;
    gate_fee: number;
    maintenance_point_price: number;
    runway_fee: number;
    stand_fee: number;
    turnaround_point_price: number;
  };
  next_actions: Array<{
    code: "BUY_AIRCRAFT" | "FIX_SCHEDULE" | "PLAN_ROUTE" | "SELECT_BASE" | "VIEW_FLIGHTS";
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
  slots: {
    busiest_day: number;
    capacity_per_day: number;
    days: Array<{
      capacity: number;
      current: number;
      day: number;
      projected: number;
      remaining: number;
      utilization: number;
    }>;
    model: "airline_planning_headroom";
  };
  status: "blocked" | "missing" | "ready" | "warning";
};

