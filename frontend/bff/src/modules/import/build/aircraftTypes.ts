import type { AircraftTypePayload, FinalAircraftType, SourceIssueSink } from "../shared/types";

import { clean, pickNumber, pickString } from "./shared";

type AircraftTypeSource = AircraftTypePayload & {
  manufacturer_id?: string;
};

type NumberField = keyof Pick<
  AircraftTypePayload,
  | "base_maintenance_points"
  | "base_turnaround_points"
  | "cruising_speed_kph"
  | "d_check_interval_fh"
  | "d_check_interval_years"
  | "d_check_overdue_multiplier"
  | "fuel_consumption_per_hour"
  | "maint_cost_per_flight_hour"
  | "maint_cost_per_landing"
  | "maint_cost_per_takeoff"
  | "max_planned_seat_capacity"
  | "max_range_km"
  | "min_runway_length_m"
  | "mtow_kg"
  | "price_per_unit"
  | "production_points_price"
>;

type StringField = keyof Pick<AircraftTypePayload, "characteristics" | "iata_code" | "icao_code" | "image_upload_id" | "model_name">;

type OverrideField<TField extends keyof AircraftTypePayload> = {
  aliases: string[];
  field: TField;
};

const AIRCRAFT_TYPES: AircraftTypeSource[] = [
  aircraftType("Airbus A220-300", "223", "BCS3", 149, 6300, 829, 3670, 1200, 67591, 91000000, 2100, 12_000),
  aircraftType("Airbus A320neo", "32N", "A20N", 180, 6500, 839, 4900, 1500, 79000, 110600000, 2600, 14_000),
  aircraftType("Airbus A321neo", "32Q", "A21N", 220, 7400, 839, 5600, 1700, 97000, 129500000, 3100, 16_000),
  aircraftType("Airbus A330-300", "333", "A333", 300, 11750, 871, 9800, 2500, 242000, 264200000, 6200, 24_000),
  aircraftType("Airbus A350-900", "359", "A359", 350, 15000, 903, 6800, 2600, 280000, 317400000, 7200, 26_000),
  aircraftType("Airbus A380-800", "388", "A388", 525, 14800, 903, 12000, 2900, 575000, 445600000, 11800, 32_000),
  aircraftType("ATR 72-600", "AT7", "AT76", 78, 1528, 510, 760, 1050, 23000, 26000000, 850, 8_000),
  aircraftType("Boeing 737-800", "738", "B738", 189, 5765, 842, 5000, 1600, 79016, 106100000, 2800, 14_000),
  aircraftType("Boeing 737 MAX 8", "7M8", "B38M", 178, 6570, 839, 4600, 1600, 82190, 121600000, 2850, 14_500),
  aircraftType("Boeing 777-300ER", "77W", "B77W", 396, 13650, 905, 7800, 2800, 351534, 375500000, 9300, 28_000),
  aircraftType("Boeing 787-9", "789", "B789", 290, 14140, 903, 5600, 2500, 254011, 292500000, 6500, 24_000),
  aircraftType("Embraer E190-E2", "290", "E290", 114, 5278, 870, 2600, 1300, 61500, 62000000, 1450, 10_000),
];

const NUMBER_OVERRIDE_FIELDS: Array<OverrideField<NumberField>> = [
  { aliases: ["base_maintenance_points", "baseMaintenancePoints"], field: "base_maintenance_points" },
  { aliases: ["base_turnaround_points", "baseTurnaroundPoints"], field: "base_turnaround_points" },
  { aliases: ["cruising_speed_kph", "cruisingSpeedKph"], field: "cruising_speed_kph" },
  { aliases: ["d_check_interval_fh", "dCheckIntervalFh"], field: "d_check_interval_fh" },
  { aliases: ["d_check_interval_years", "dCheckIntervalYears"], field: "d_check_interval_years" },
  { aliases: ["d_check_overdue_multiplier", "dCheckOverdueMultiplier"], field: "d_check_overdue_multiplier" },
  { aliases: ["fuel_consumption_per_hour", "fuelConsumptionPerHour"], field: "fuel_consumption_per_hour" },
  { aliases: ["maint_cost_per_flight_hour", "maintCostPerFlightHour"], field: "maint_cost_per_flight_hour" },
  { aliases: ["maint_cost_per_landing", "maintCostPerLanding"], field: "maint_cost_per_landing" },
  { aliases: ["maint_cost_per_takeoff", "maintCostPerTakeoff"], field: "maint_cost_per_takeoff" },
  { aliases: ["max_planned_seat_capacity", "maxPlannedSeatCapacity"], field: "max_planned_seat_capacity" },
  { aliases: ["max_range_km", "maxRangeKm"], field: "max_range_km" },
  { aliases: ["min_runway_length_m", "minRunwayLengthM"], field: "min_runway_length_m" },
  { aliases: ["mtow_kg", "mtowKg"], field: "mtow_kg" },
  { aliases: ["price_per_unit", "pricePerUnit"], field: "price_per_unit" },
  { aliases: ["production_points_price", "productionPointsPrice"], field: "production_points_price" },
];

const STRING_OVERRIDE_FIELDS: Array<OverrideField<StringField>> = [
  { aliases: ["characteristics"], field: "characteristics" },
  { aliases: ["iata_code", "iataCode"], field: "iata_code" },
  { aliases: ["icao_code", "icaoCode"], field: "icao_code" },
  { aliases: ["image_upload_id", "imageUploadId"], field: "image_upload_id" },
  { aliases: ["model_name", "modelName"], field: "model_name" },
];

export function buildAircraftTypes(issues: SourceIssueSink, overrides: Record<string, Record<string, unknown>>): FinalAircraftType[] {
  const aircraftTypes = AIRCRAFT_TYPES.map((source) => applyOverride(source, overrides));
  const seenIcao = new Set<string>();

  return aircraftTypes.filter((payload) => {
    const sourceKey = sourceKeyFor(payload);

    if (seenIcao.has(payload.icao_code)) {
      issues.error("aircraft-type", sourceKey, "Duplicate aircraft type ICAO code");
      return false;
    }

    seenIcao.add(payload.icao_code);

    return true;
  }).map((payload) => ({
    payload,
    sourceKey: sourceKeyFor(payload),
  }));
}

function aircraftType(
  modelName: string,
  iataCode: string,
  icaoCode: string,
  seats: number,
  rangeKm: number,
  speedKph: number,
  fuelPerHour: number,
  runwayM: number,
  mtowKg: number,
  price: number,
  maintPerFlightHour: number,
  baseMaintenancePoints: number,
): AircraftTypeSource {
  return {
    base_maintenance_points: baseMaintenancePoints,
    base_turnaround_points: Math.max(20, Math.round(seats / 6)),
    characteristics: buildCharacteristics(seats, rangeKm, runwayM),
    cruising_speed_kph: speedKph,
    d_check_interval_fh: 24_000,
    d_check_interval_years: 6,
    d_check_overdue_multiplier: 1.35,
    fuel_consumption_per_hour: fuelPerHour,
    iata_code: iataCode,
    icao_code: icaoCode,
    image_upload_id: "",
    maint_cost_per_flight_hour: maintPerFlightHour,
    maint_cost_per_landing: Math.round(maintPerFlightHour * 0.8),
    maint_cost_per_takeoff: Math.round(maintPerFlightHour * 0.9),
    max_planned_seat_capacity: seats,
    max_range_km: rangeKm,
    min_runway_length_m: runwayM,
    model_name: modelName,
    mtow_kg: mtowKg,
    price_per_unit: price,
    production_points_price: Math.max(100, Math.round(price / 50_000)),
  };
}

function applyOverride(source: AircraftTypeSource, overrides: Record<string, Record<string, unknown>>): AircraftTypePayload {
  const override = overrides[source.icao_code] ?? overrides[source.model_name] ?? {};
  const manufacturerId = pickString(override, ["manufacturer_id", "manufacturerId"]);
  const payload = applyStringOverrides(applyNumberOverrides(source, override), override);

  if (manufacturerId) {
    return { ...payload, manufacturer_id: manufacturerId };
  }

  return payload;
}

function applyNumberOverrides(source: AircraftTypePayload, override: Record<string, unknown>): AircraftTypePayload {
  const payload: AircraftTypePayload = { ...source };

  for (const { aliases, field } of NUMBER_OVERRIDE_FIELDS) {
    const value = pickNumber(override, aliases);

    if (value != null) {
      payload[field] = value;
    }
  }

  return payload;
}

function applyStringOverrides(source: AircraftTypePayload, override: Record<string, unknown>): AircraftTypePayload {
  const payload: AircraftTypePayload = { ...source };

  for (const { aliases, field } of STRING_OVERRIDE_FIELDS) {
    const value = pickString(override, aliases);

    if (value != null) {
      payload[field] = field === "iata_code" || field === "icao_code" ? value.toUpperCase() : value;
    }
  }

  return payload;
}

function buildCharacteristics(seats: number, rangeKm: number, runwayM: number): string {
  return JSON.stringify({
    category: aircraftCategory(seats),
    rangeClass: rangeClass(rangeKm),
    runwayClass: runwayClass(runwayM),
  });
}

function aircraftCategory(seats: number): string {
  if (seats >= 300) {
    return "widebody";
  }
  if (seats >= 100) {
    return "narrowbody";
  }

  return "regional";
}

function rangeClass(rangeKm: number): string {
  if (rangeKm >= 10_000) {
    return "long-haul";
  }
  if (rangeKm >= 4500) {
    return "medium-haul";
  }

  return "regional";
}

function runwayClass(runwayM: number): string {
  if (runwayM >= 2400) {
    return "long";
  }
  if (runwayM >= 1400) {
    return "medium";
  }

  return "short";
}

function sourceKeyFor(payload: AircraftTypePayload): string {
  return `aircraft-type:${clean(payload.icao_code).toUpperCase()}`;
}
