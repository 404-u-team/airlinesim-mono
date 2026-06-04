import type { BffConfig } from "../../config";

import { BackendHttpError } from "../../backend-http";
import { jsonResponse } from "../../http";
import { aircraftStateConstraints, airportDataConstraints, rangeConstraints, runwayConstraints } from "./constraints";
import { buildBaseFacilitiesOverview } from "./overview";
import { loadFacilitiesSnapshot } from "./snapshot";

export async function handleFacilitiesRequest(
  request: Request,
  url: URL,
  config: BffConfig,
): Promise<null | Response> {
  if (!url.pathname.startsWith("/facilities/") || request.method !== "GET") {
    return null;
  }

  try {
    const snapshot = await loadFacilitiesSnapshot(request, config);

    if (url.pathname === "/facilities/base-overview") {
      return jsonResponse(buildBaseFacilitiesOverview(snapshot));
    }

    const match = /^\/facilities\/airports\/([^/]+)\/constraints$/.exec(url.pathname);
    if (match?.[1]) {
      return jsonResponse(buildAirportConstraints(snapshot, decodeURIComponent(match[1]), url.searchParams));
    }

    return jsonResponse({ error: { code: "FACILITIES_NOT_FOUND", message: "Facilities endpoint not found." } }, { status: 404 });
  } catch (error) {
    return facilitiesError(error);
  }
}

function buildAirportConstraints(
  snapshot: Awaited<ReturnType<typeof loadFacilitiesSnapshot>>,
  airportId: string,
  searchParams: URLSearchParams,
): Record<string, unknown> {
  const airport = snapshot.airports.find((item) => item.id === airportId);
  const aircraft = snapshot.aircrafts.find((item) => item.id === searchParams.get("aircraft_id"));
  const route = snapshot.routes.find((item) => item.id === searchParams.get("route_id"));
  const type = snapshot.aircraftTypes.find((item) =>
    item.id === (searchParams.get("aircraft_type_id") ?? aircraft?.type_id ?? route?.selected_aircraft_type_id),
  );

  return {
    airport: airport ?? null,
    constraints: [
      ...airportDataConstraints(airport),
      ...(type ? runwayConstraints(airport, type) : []),
      ...(route && type ? rangeConstraints(route.demand_snapshot.distance_km, type) : []),
      ...(aircraft ? aircraftStateConstraints(aircraft) : []),
    ],
  };
}

function facilitiesError(error: unknown): Response {
  if (error instanceof BackendHttpError) {
    return jsonResponse(error.toNormalizedJson(), { status: error.status });
  }

  return jsonResponse({
    error: {
      code: "FACILITIES_ERROR",
      message: error instanceof Error ? error.message : "Facilities request failed.",
    },
  }, { status: 500 });
}

