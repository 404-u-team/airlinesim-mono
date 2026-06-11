/* eslint-disable @typescript-eslint/require-await -- storage API is async by contract over a synchronous SQLite store. */
import { resolve } from "node:path";

import type { StoredFlight, StoredSchedule } from "./types";

import { readDocument, writeDocument } from "../../db/database";
import { currentFlightStatus } from "./flights";

const flightsLegacyPath = resolve(import.meta.dir, "../../../data/game-state/flights.json");
const schedulesLegacyPath = resolve(import.meta.dir, "../../../data/game-state/schedules.json");

export async function deleteFlightsForRoute(routeId: string): Promise<void> {
  const currentFlights = readFlights();
  const remaining = currentFlights.filter((flight) => flight.route_id !== routeId);

  if (remaining.length !== currentFlights.length) {
    writeDocument("flights", remaining);
  }
}

export async function deleteFutureFlightsForSchedules(scheduleIds: string[], keepFlightIds: string[] = []): Promise<void> {
  if (scheduleIds.length === 0) {
    return;
  }
  const targetIds = new Set(scheduleIds);
  const keptIds = new Set(keepFlightIds);
  const currentFlights = readFlights();
  // Status is derived live: a stored "scheduled" row may already be airborne, and a
  // departed or explicitly kept leg (in-progress rotation) must survive the rebuild.
  const remaining = currentFlights.filter(
    (flight) => !(targetIds.has(flight.schedule_id) && currentFlightStatus(flight) === "scheduled" && !keptIds.has(flight.id)),
  );

  if (remaining.length !== currentFlights.length) {
    writeDocument("flights", remaining);
  }
}

export async function deleteSchedulesForAircraft(airlineId: string, aircraftId: string): Promise<string[]> {
  const schedules = readSchedules();
  const removed = schedules.filter(
    (schedule) => schedule.airline_id === airlineId && schedule.aircraft_id === aircraftId,
  );
  if (removed.length === 0) {
    return [];
  }
  const removedIds = new Set(removed.map((schedule) => schedule.id));

  writeDocument("schedules", schedules.filter((schedule) => !removedIds.has(schedule.id)));

  return [...removedIds];
}

export async function deleteSchedulesForRoute(routeId: string): Promise<void> {
  const schedules = readSchedules();
  const remaining = schedules.filter((schedule) => schedule.route_id !== routeId);

  if (remaining.length !== schedules.length) {
    writeDocument("schedules", remaining);
  }
}

export async function listFlightsForAirline(airlineId: string): Promise<StoredFlight[]> {
  return readFlights().filter((flight) => flight.airline_id === airlineId);
}

export async function listSchedulesForAirline(airlineId: string): Promise<StoredSchedule[]> {
  return readSchedules().filter((schedule) => schedule.airline_id === airlineId);
}

export async function saveFlights(nextFlights: StoredFlight[]): Promise<void> {
  const currentFlights = readFlights();
  const nextById = new Map(nextFlights.map((flight) => [flight.id, flight]));
  const merged = [
    ...currentFlights.filter((flight) => !nextById.has(flight.id)),
    ...nextFlights,
  ];

  writeDocument("flights", merged);
}

export async function saveSchedule(schedule: StoredSchedule): Promise<StoredSchedule> {
  const schedules = readSchedules();
  const existingIndex = schedules.findIndex((item) => item.id === schedule.id);

  if (existingIndex >= 0) {
    schedules[existingIndex] = schedule;
  } else {
    schedules.push(schedule);
  }

  writeDocument("schedules", schedules);

  return schedule;
}

function readFlights(): StoredFlight[] {
  return readDocument<StoredFlight[]>("flights", [], flightsLegacyPath);
}

function readSchedules(): StoredSchedule[] {
  return readDocument<StoredSchedule[]>("schedules", [], schedulesLegacyPath);
}
