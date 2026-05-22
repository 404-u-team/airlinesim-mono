import type { BffConfig } from "../../config";

import { getUserAuthorization, requireValidUserToken } from "../../auth";
import { jsonResponse } from "../../http";

type Airport = {
  country_id?: string;
  iata_code?: string;
  icao_code?: string;
  id?: string;
  intl_name?: string;
  local_name?: string;
  municipality?: string;
};

type AirportsResponse = {
  airports?: Airport[];
};

export async function handleProxyRequest(
  request: Request,
  url: URL,
  config: BffConfig,
): Promise<null | Response> {
  if (request.method === "GET" && url.pathname === "/proxy/airports") {
    return proxyAirports(request, url, config);
  }

  return null;
}

function airportMatchesQuery(airport: Airport, query: string): boolean {
  return [
    airport.iata_code,
    airport.icao_code,
    airport.intl_name,
    airport.local_name,
    airport.municipality,
  ].some((value) => value?.toLowerCase().includes(query));
}

function filterAirports(airports: Airport[], searchParams: URLSearchParams): Airport[] {
  const countryId = searchParams.get("country_id")?.toLowerCase();
  const iataCode = searchParams.get("iata_code")?.toLowerCase();
  const icaoCode = searchParams.get("icao_code")?.toLowerCase();
  const query = searchParams.get("q")?.toLowerCase();

  return airports.filter((airport) => {
    if (countryId && airport.country_id?.toLowerCase() !== countryId) {
      return false;
    }

    if (iataCode && airport.iata_code?.toLowerCase() !== iataCode) {
      return false;
    }

    if (icaoCode && airport.icao_code?.toLowerCase() !== icaoCode) {
      return false;
    }

    if (query && !airportMatchesQuery(airport, query)) {
      return false;
    }

    return true;
  });
}

function forwardAuthHeaders(request: Request): Headers {
  const headers = new Headers();
  const authorization = getUserAuthorization(request);

  if (authorization) {
    headers.set("Authorization", authorization);
  }

  return headers;
}

async function proxyAirports(
  request: Request,
  url: URL,
  config: BffConfig,
): Promise<Response> {
  const authError = await requireValidUserToken(request, config);

  if (authError) {
    return authError;
  }

  const backendResponse = await fetch(`${config.backendBaseUrl}/airports`, {
    headers: forwardAuthHeaders(request),
  });

  if (!backendResponse.ok) {
    return jsonResponse(
      { error: "Backend request failed" },
      { status: backendResponse.status },
    );
  }

  const payload = (await backendResponse.json()) as AirportsResponse;
  const filteredAirports = filterAirports(payload.airports ?? [], url.searchParams);

  return jsonResponse({ airports: filteredAirports });
}
