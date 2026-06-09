/* eslint-disable @typescript-eslint/require-await -- storage API is async by contract over a synchronous SQLite store. */
import { resolve } from "node:path";

import type { StoredRoute } from "./types";

import { readDocument, writeDocument } from "../../db/database";

const routesLegacyPath = resolve(import.meta.dir, "../../../data/game-state/routes.json");

export async function deleteRoute(routeId: string, airlineId: string): Promise<null | StoredRoute> {
  const routes = await readRoutes();
  const route = routes.find((item) => item.id === routeId && item.airline_id === airlineId);

  if (!route) {
    return null;
  }

  writeDocument("routes", routes.filter((item) => item.id !== routeId));

  return route;
}

export async function findRoute(routeId: string, airlineId: string): Promise<null | StoredRoute> {
  const routes = await readRoutes();

  return routes.find((item) => item.id === routeId && item.airline_id === airlineId) ?? null;
}

export async function listRoutesForAirline(airlineId: string): Promise<StoredRoute[]> {
  const routes = await readRoutes();

  return routes.filter((route) => route.airline_id === airlineId);
}

export async function readRoutes(): Promise<StoredRoute[]> {
  return readDocument<StoredRoute[]>("routes", [], routesLegacyPath);
}

export async function saveRoute(route: StoredRoute): Promise<StoredRoute> {
  const routes = await readRoutes();
  const existingIndex = routes.findIndex((item) => item.id === route.id);

  if (existingIndex >= 0) {
    routes[existingIndex] = route;
  } else {
    routes.push(route);
  }

  writeDocument("routes", routes);

  return route;
}
