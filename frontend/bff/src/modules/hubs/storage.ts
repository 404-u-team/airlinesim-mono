/* eslint-disable @typescript-eslint/require-await -- storage API is async by contract over a synchronous SQLite store. */
import { readDocument, writeDocument } from "../../db/database";

export type StoredHub = {
  airline_id: string;
  airport_id: string;
  created_at: string;
  fee: number;
};

export async function addHub(hub: StoredHub): Promise<StoredHub> {
  const hubs = readHubs();

  if (!hubs.some((item) => item.airline_id === hub.airline_id && item.airport_id === hub.airport_id)) {
    writeDocument("hubs", [...hubs, hub]);
  }

  return hub;
}

export async function listHubsForAirline(airlineId: string): Promise<StoredHub[]> {
  return readHubs().filter((hub) => hub.airline_id === airlineId);
}

export async function removeHub(airlineId: string, airportId: string): Promise<boolean> {
  const hubs = readHubs();
  const next = hubs.filter((hub) => !(hub.airline_id === airlineId && hub.airport_id === airportId));

  if (next.length === hubs.length) {
    return false;
  }
  writeDocument("hubs", next);

  return true;
}

function readHubs(): StoredHub[] {
  return readDocument<StoredHub[]>("hubs", []);
}
