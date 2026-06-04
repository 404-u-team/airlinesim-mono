import { expect, test } from "bun:test";

import type { Airport } from "../src/modules/fleet/types";
import type { OperationsSnapshot } from "../src/modules/operations/planning";
import type { StoredRoute } from "../src/modules/routes/types";

import {
  arrivalLocalDayOffset,
  arrivalLocalTime,
  nightOperationConstraints,
  rangeConstraints,
  runwayConstraints,
  runwayMargin,
} from "../src/modules/facilities/constraints";
import { airportCostProfile } from "../src/modules/facilities/costs";
import { buildBaseFacilitiesOverview } from "../src/modules/facilities/overview";
import { buildSlotCapacity, slotCapacityConstraints } from "../src/modules/facilities/slots";
import { buildSchedulePreview } from "../src/modules/operations/planning";

const base: Airport = {
  gate_fee: 100,
  iata_code: "ICN",
  id: "base",
  max_runway_length_m: 3000,
  max_runway_uses_per_day: 2,
  runway_fee: 200,
  stand_fee: 50,
  timezone: "Asia/Seoul",
  turnaround_point_price: 25,
  works_at_night: true,
};
const destination: Airport = {
  iata_code: "NRT",
  id: "destination",
  max_runway_length_m: 2500,
  max_runway_uses_per_day: 2,
  timezone: "Asia/Tokyo",
  works_at_night: true,
};

test("runway and range constraints expose margins and block missing or insufficient data", () => {
  const type = { id: "type", max_range_km: 1200, min_runway_length_m: 1800 };

  expect(runwayMargin(base, type)).toBe(1200);
  expect(runwayConstraints(base, type)).toEqual([]);
  expect(runwayConstraints({ ...base, max_runway_length_m: 1200 }, type)[0]?.code).toBe("AIRPORT_RUNWAY_TOO_SHORT");
  expect(runwayConstraints({ id: "missing" }, type)[0]?.code).toBe("AIRPORT_DATA_INCOMPLETE");
  expect(rangeConstraints(1300, type)[0]?.code).toBe("AIRCRAFT_RANGE_TOO_SHORT");
});

test("night constraints use local departure and arrival time and surface missing timezone", () => {
  const closedAtNight = { ...base, works_at_night: false };
  const arrival = arrivalLocalTime("18:00", 6, "Asia/Seoul", "Europe/Istanbul");
  const arrivalDayOffset = arrivalLocalDayOffset("23:00", 4, "Europe/Istanbul", "Asia/Seoul");

  expect(nightOperationConstraints(closedAtNight, "23:30")[0]?.code).toBe("AIRPORT_NIGHT_OPS_PROHIBITED");
  expect(arrival).toBe("18:00");
  expect(arrivalDayOffset).toBe(1);
  expect(nightOperationConstraints({ ...closedAtNight, timezone: undefined }, "12:00")[0]?.code).toBe("AIRPORT_TIMEZONE_MISSING");
});

test("slot model counts active schedules, warns at 80 percent, and blocks above capacity", () => {
  const route = storedRoute("route-active");
  const schedule = {
    aircraft_id: "aircraft",
    airline_id: "airline",
    checks_snapshot: [],
    created_at: "",
    id: "schedule",
    pattern: { days_of_week: [1], departure_local_time: "09:00", mode: "weekly" as const, turnaround_minutes: 60 },
    route_id: route.id,
    status: "active" as const,
    updated_at: "",
    validity: { starts_on: "2026-06-01" },
  };
  const warningSlots = buildSlotCapacity({ ...base, max_runway_uses_per_day: 2 }, [route], [schedule], [], { 1: 1 });
  const blockedSlots = buildSlotCapacity({ ...base, max_runway_uses_per_day: 1 }, [route], [schedule], [], { 1: 1 });

  expect(warningSlots.days.find((day) => day.day === 1)).toMatchObject({ current: 1, projected: 2, remaining: 0 });
  expect(slotCapacityConstraints(base, warningSlots)[0]?.code).toBe("AIRPORT_SLOT_CAPACITY_LOW");
  expect(slotCapacityConstraints(base, blockedSlots)[0]?.code).toBe("AIRPORT_SLOT_CAPACITY_EXCEEDED");
});

test("facilities overview and schedule preview share costs, runway, slots, and night blockers", () => {
  const snapshot = operationsSnapshot();
  const overview = buildBaseFacilitiesOverview(snapshot);
  const preview = buildSchedulePreview(snapshot, {
    aircraft_id: "aircraft",
    days_of_week: [1],
    departure_local_time: "23:30",
    route_id: "route-preview",
  });

  expect(overview.costs).toEqual(airportCostProfile(base));
  expect(overview.aircraft_compatibility[0]?.runway_margin_m).toBe(1200);
  expect(preview.blockers.map((item) => item.code)).toContain("AIRPORT_NIGHT_OPS_PROHIBITED");
  expect(preview.blockers.map((item) => item.code)).toContain("AIRPORT_SLOT_CAPACITY_EXCEEDED");
});

function operationsSnapshot(): OperationsSnapshot {
  const activeRoute = storedRoute("route-active");
  const previewRoute = storedRoute("route-preview");

  return {
    aircrafts: [{
      base_airport_id: "base",
      current_maintenance_points: 100,
      id: "aircraft",
      max_maintenance_points_cached: 100,
      status: "ready",
      type_id: "type",
    }],
    aircraftTypes: [{
      cruising_speed_kph: 800,
      id: "type",
      max_range_km: 5000,
      min_runway_length_m: 1800,
    }],
    airline: { balance: 100_000_000, id: "airline", starting_airport_id: "base" },
    airports: [{ ...base, max_runway_uses_per_day: 1, works_at_night: false }, destination],
    countries: [],
    flights: [],
    regionLinks: [],
    regions: [],
    routes: [activeRoute, previewRoute],
    schedules: [{
      aircraft_id: "other-aircraft",
      airline_id: "airline",
      checks_snapshot: [],
      created_at: "",
      id: "schedule-active",
      pattern: { days_of_week: [1], departure_local_time: "09:00", mode: "weekly", turnaround_minutes: 60 },
      route_id: activeRoute.id,
      status: "active",
      updated_at: "",
      validity: { starts_on: "2026-06-01" },
    }],
  };
}

function storedRoute(id: string): StoredRoute {
  return {
    airline_id: "airline",
    base_frequency_per_week: 1,
    constraints_snapshot: [],
    created_at: "",
    demand_snapshot: {
      calculated_at: "",
      destination_daily_passengers: 100,
      distance_km: 1000,
      origin_daily_passengers: 100,
    },
    destination_airport_id: "destination",
    economics_snapshot: {
      confidence: "high",
      estimated_cost_per_flight: 1000,
      estimated_fare_per_passenger: 100,
      estimated_profit_per_flight: 1000,
      estimated_revenue_per_flight: 2000,
      expected_load_factor: 0.8,
    },
    id,
    origin_airport_id: "base",
    status: id === "route-preview" ? "awaiting_schedule" : "scheduled",
    updated_at: "",
  };
}
