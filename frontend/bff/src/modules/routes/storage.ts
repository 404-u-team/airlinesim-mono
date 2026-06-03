import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import type { StoredRoute } from "./types";

const routesPath = resolve(import.meta.dir, "../../../data/game-state/routes.json");

export async function deleteRoute(routeId: string, airlineId: string): Promise<null | StoredRoute> {
  const routes = await readRoutes();
  const route = routes.find((item) => item.id === routeId && item.airline_id === airlineId);

  if (!route) {
    return null;
  }

  await writeRoutes(routes.filter((item) => item.id !== routeId));

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
  try {
    const raw = await readFile(routesPath, "utf8");
    const payload = JSON.parse(raw) as unknown;

    return Array.isArray(payload) ? (payload as StoredRoute[]) : [];
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

export async function saveRoute(route: StoredRoute): Promise<StoredRoute> {
  const routes = await readRoutes();
  const existingIndex = routes.findIndex((item) => item.id === route.id);

  if (existingIndex >= 0) {
    routes[existingIndex] = route;
  } else {
    routes.push(route);
  }

  await writeRoutes(routes);

  return route;
}

export async function writeRoutes(routes: StoredRoute[]): Promise<void> {
  await mkdir(dirname(routesPath), { recursive: true });

  const tmpPath = `${routesPath}.${crypto.randomUUID()}.tmp`;
  await writeFile(tmpPath, JSON.stringify(routes, null, 2));
  await rename(tmpPath, routesPath);
}
