import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import type { StoredFlight, StoredSchedule } from "./types";

const flightsPath = resolve(import.meta.dir, "../../../data/game-state/flights.json");
const schedulesPath = resolve(import.meta.dir, "../../../data/game-state/schedules.json");

export async function listFlightsForAirline(airlineId: string): Promise<StoredFlight[]> {
  const flights = await readArray<StoredFlight>(flightsPath);

  return flights.filter((flight) => flight.airline_id === airlineId);
}

export async function listSchedulesForAirline(airlineId: string): Promise<StoredSchedule[]> {
  const schedules = await readArray<StoredSchedule>(schedulesPath);

  return schedules.filter((schedule) => schedule.airline_id === airlineId);
}

export async function saveFlights(nextFlights: StoredFlight[]): Promise<void> {
  const currentFlights = await readArray<StoredFlight>(flightsPath);
  const nextById = new Map(nextFlights.map((flight) => [flight.id, flight]));
  const merged = [
    ...currentFlights.filter((flight) => !nextById.has(flight.id)),
    ...nextFlights,
  ];

  await writeArray(flightsPath, merged);
}

export async function saveSchedule(schedule: StoredSchedule): Promise<StoredSchedule> {
  const schedules = await readArray<StoredSchedule>(schedulesPath);
  const existingIndex = schedules.findIndex((item) => item.id === schedule.id);

  if (existingIndex >= 0) {
    schedules[existingIndex] = schedule;
  } else {
    schedules.push(schedule);
  }

  await writeArray(schedulesPath, schedules);

  return schedule;
}

async function readArray<TValue>(path: string): Promise<TValue[]> {
  try {
    const raw = await readFile(path, "utf8");
    const payload = JSON.parse(raw) as unknown;

    return Array.isArray(payload) ? (payload as TValue[]) : [];
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

async function writeArray(path: string, value: unknown[]): Promise<void> {
  await mkdir(dirname(path), { recursive: true });

  const tmpPath = `${path}.${crypto.randomUUID()}.tmp`;
  await writeFile(tmpPath, JSON.stringify(value, null, 2));
  await rename(tmpPath, path);
}
