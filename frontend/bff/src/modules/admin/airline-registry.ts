/* eslint-disable @typescript-eslint/require-await -- storage API is async by contract over a synchronous SQLite store. */
import { readDocument, writeDocument } from "../../db/database";

// A lightweight directory of airlines the BFF has seen (populated when a user's
// airline is resolved). The backend remains the source of truth for details; this
// only lets the admin pick an airline without a backend list endpoint.
export type AirlineRegistryEntry = {
  created_at: string;
  id: string;
  last_seen_at: string;
  name: string;
};

export async function listAirlineRegistry(): Promise<AirlineRegistryEntry[]> {
  return readRegistry()
    .slice()
    .sort((left, right) => right.last_seen_at.localeCompare(left.last_seen_at));
}

export async function upsertAirlineRegistry(airline: { id: string; name?: string }): Promise<void> {
  if (!airline.id) {
    return;
  }
  const now = new Date().toISOString();
  const registry = readRegistry();
  const existing = registry.find((entry) => entry.id === airline.id);

  if (existing) {
    existing.last_seen_at = now;
    if (airline.name) {
      existing.name = airline.name;
    }
  } else {
    registry.push({ created_at: now, id: airline.id, last_seen_at: now, name: airline.name ?? airline.id });
  }

  writeDocument("airline_registry", registry);
}

function readRegistry(): AirlineRegistryEntry[] {
  return readDocument<AirlineRegistryEntry[]>("airline_registry", []);
}
