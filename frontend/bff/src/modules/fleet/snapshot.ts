import type { BffConfig } from "../../config";
import type { Aircraft, AircraftType, Airline, Airport, Country, FleetSnapshot } from "./types";

import { getBackendAdminToken, getUserAuthorization } from "../../auth";
import { BackendHttpError, requestBackendJson } from "../../backend-http";
import { getCachedListInternal } from "../proxy";

export function getCountryForAirport(snapshot: FleetSnapshot, airportId: string | undefined): Country | undefined {
  const airport = snapshot.airports.find((item) => item.id === airportId);

  return snapshot.countries.find((country) => country.id === airport?.country_id);
}

export async function loadFleetSnapshot(request: Request, config: BffConfig): Promise<FleetSnapshot> {
  const authorization = getUserAuthorization(request);
  if (!authorization) {
    throw new BackendHttpError("Authentication required.", 401, "AUTH_REQUIRED", false);
  }

  const adminRequest = await createAdminRequest(request, config);
  const [airline, aircrafts, aircraftTypes, airports, countries] = await Promise.all([
    requestBackendJson<Airline>(config, "/airline/me", { token: authorization }),
    requestBackendJson<{ items?: Aircraft[] }>(config, "/aircrafts", { token: authorization }),
    getCachedListInternal<AircraftType>(adminRequest, config, "/aircraft-types", "items"),
    getCachedListInternal<Airport>(adminRequest, config, "/airports", "airports"),
    getCachedListInternal<Country>(adminRequest, config, "/countries", "countries"),
  ]);

  return {
    aircrafts: aircrafts.items ?? [],
    aircraftTypes,
    airline,
    airports,
    countries,
  };
}

async function createAdminRequest(request: Request, config: BffConfig): Promise<Request> {
  const adminToken = await getBackendAdminToken(config);

  return new Request(request.url, {
    headers: {
      Authorization: `Bearer ${adminToken}`,
    },
  });
}
