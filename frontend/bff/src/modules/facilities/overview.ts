import type { Airport } from "../fleet/types";
import type { OperationsSnapshot } from "../operations/planning";
import type { AirportConstraint, BaseFacilitiesOverview } from "./types";

import { resolveAircraftImageUrl } from "../aircraft-images/resolve";
import { estimateBlockHours } from "../operations/flights";
import { aircraftStateConstraints, airportDataConstraints, arrivalLocalTime, nightOperationConstraints, runwayConstraints, runwayMargin } from "./constraints";
import { airportCostProfile } from "./costs";
import { buildSlotCapacity, slotCapacityConstraints } from "./slots";

export function buildBaseFacilitiesOverview(snapshot: OperationsSnapshot): BaseFacilitiesOverview {
  const base = snapshot.airports.find((airport) => airport.id === snapshot.airline.starting_airport_id);
  const basedAircraft = snapshot.aircrafts.filter((aircraft) => aircraft.base_airport_id === base?.id);
  const typeById = new Map(snapshot.aircraftTypes.map((type) => [type.id, type]));
  const compatibility = basedAircraft.map((aircraft) => {
    const type = typeById.get(aircraft.type_id) ?? null;
    const constraints = [
      ...runwayConstraints(base, type),
      ...aircraftStateConstraints(aircraft),
    ];

    return {
      aircraft,
      compatible: !constraints.some((item) => item.blocking),
      constraints,
      runway_margin_m: runwayMargin(base, type),
      type: type ? { ...type, image_url: resolveAircraftImageUrl(type) } : null,
    };
  });
  const slots = buildSlotCapacity(base, snapshot.routes, snapshot.schedules, snapshot.flights);
  const constraints = dedupe([
    ...airportDataConstraints(base),
    ...slotCapacityConstraints(base, slots),
    ...compatibility.flatMap((item) => item.constraints),
  ]);
  const affectedSchedules = countAffectedNightSchedules(snapshot, base?.id);

  if (affectedSchedules > 0) {
    constraints.push(...nightOperationConstraints(base, "23:00"));
  }

  return {
    aircraft_compatibility: compatibility,
    base_airport: base ? { ...base, label: airportLabel(base) } : null,
    constraints: dedupe(constraints),
    costs: airportCostProfile(base),
    next_actions: nextActions(Boolean(base), compatibility.length, constraints),
    night_operations: {
      affected_schedules: affectedSchedules,
      enabled: base?.works_at_night !== false,
      night_window: "23:00-06:00",
    },
    runway: {
      compatible_owned_aircraft: compatibility.filter((item) => item.compatible).length,
      incompatible_owned_aircraft: compatibility.filter((item) => !item.compatible).length,
      max_length_m: base?.max_runway_length_m ?? 0,
    },
    slots,
    status: getStatus(base, constraints),
  };
}

function airportLabel(airport: Airport): string {
  return `${airport.iata_code ?? airport.icao_code ?? "----"} - ${airport.intl_name ?? airport.local_name ?? "Airport"}`;
}

function countAffectedNightSchedules(snapshot: OperationsSnapshot, airportId: string | undefined): number {
  const routeById = new Map(snapshot.routes.map((route) => [route.id, route]));
  const aircraftById = new Map(snapshot.aircrafts.map((aircraft) => [aircraft.id, aircraft]));
  const typeById = new Map(snapshot.aircraftTypes.map((type) => [type.id, type]));
  const airportById = new Map(snapshot.airports.map((airport) => [airport.id, airport]));

  return snapshot.schedules.filter((schedule) => schedule.status === "active" && scheduleConflictsWithNight(
    schedule, airportId, routeById, aircraftById, typeById, airportById,
  )).length;
}

function dedupe(constraints: AirportConstraint[]): AirportConstraint[] {
  const seen = new Set<string>();

  return constraints.filter((item) => {
    const key = `${item.code}:${item.affected.airport_id ?? ""}:${item.affected.aircraft_id ?? ""}:${String(item.parameters.day ?? "")}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function getStatus(
  base: Airport | undefined,
  constraints: AirportConstraint[],
): BaseFacilitiesOverview["status"] {
  if (!base) {
    return "missing";
  }
  if (constraints.some((item) => item.blocking)) {
    return "blocked";
  }

  return constraints.length > 0 ? "warning" : "ready";
}

function nextActions(
  hasBase: boolean,
  aircraftCount: number,
  constraints: AirportConstraint[],
): BaseFacilitiesOverview["next_actions"] {
  if (!hasBase) {
    return [{ code: "SELECT_BASE", target_path: "/onboarding/airline" }];
  }

  return [
    ...(aircraftCount === 0 ? [{ code: "BUY_AIRCRAFT", target_path: "/fleet/overview" }] : []),
    ...(constraints.some((item) => item.target_path === "/operations/schedule")
      ? [{ code: "FIX_SCHEDULE", target_path: "/operations/schedule" }]
      : []),
    { code: "PLAN_ROUTE", target_path: "/airports/routes" },
    { code: "VIEW_FLIGHTS", target_path: "/operations/live-flights" },
  ];
}

function scheduleConflictsWithNight(
  schedule: OperationsSnapshot["schedules"][number],
  airportId: string | undefined,
  routeById: Map<string, OperationsSnapshot["routes"][number]>,
  aircraftById: Map<string | undefined, OperationsSnapshot["aircrafts"][number]>,
  typeById: Map<string | undefined, OperationsSnapshot["aircraftTypes"][number]>,
  airportById: Map<string | undefined, Airport>,
): boolean {
  const route = routeById.get(schedule.route_id);
  const origin = airportById.get(route?.origin_airport_id);
  const destination = airportById.get(route?.destination_airport_id);
  const type = typeById.get(aircraftById.get(schedule.aircraft_id)?.type_id);
  const arrival = arrivalLocalTime(
    schedule.pattern.departure_local_time,
    estimateBlockHours(route, type),
    origin?.timezone,
    destination?.timezone,
  );
  let localTime: null | string = null;
  if (route?.origin_airport_id === airportId) {
    localTime = schedule.pattern.departure_local_time;
  } else if (route?.destination_airport_id === airportId) {
    localTime = arrival;
  }

  return Boolean(localTime) && nightOperationConstraints(airportById.get(airportId), localTime ?? "12:00")
    .some((item) => item.code === "AIRPORT_NIGHT_OPS_PROHIBITED");
}
