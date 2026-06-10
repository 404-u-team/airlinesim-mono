import type { BffConfig } from "../../config";
import type { Aircraft, AircraftType, Airline, Airport, Country, FleetSnapshot } from "./types";

import { getBackendAdminToken, getUserAuthorization, getValidatedUserAirline } from "../../auth";
import { BackendHttpError, requestBackendJson } from "../../backend-http";
import { sumLedger } from "../finance/calculator";
import { listLedgerForAirline } from "../finance/storage";
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
    getValidatedUserAirline<Airline>(request, config),
    requestBackendJson<{ items?: Aircraft[] }>(config, "/aircrafts", { token: authorization }),
    getCachedListInternal<AircraftType>(adminRequest, config, "/aircraft-types", "items"),
    getCachedListInternal<Airport>(adminRequest, config, "/airports", "airports"),
    getCachedListInternal<Country>(adminRequest, config, "/countries", "countries"),
  ]);

  const ledger = await listLedgerForAirline(airline.id ?? "");
  const ledgerDelta = sumLedger(ledger);
  const adjustedAirline = {
    ...airline,
    balance: (airline.balance ?? 0) + ledgerDelta,
  };

  return {
    aircrafts: aircrafts.items ?? [],
    aircraftTypes,
    airline: adjustedAirline,
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
