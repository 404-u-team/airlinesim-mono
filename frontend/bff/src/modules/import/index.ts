import type { BffConfig } from "../../config";

import { getBackendAdminToken, requireValidUserToken } from "../../auth";
import { jsonResponse, readJson } from "../../http";

type NormalizedAirport = {
  continent?: string;
  country_id?: string;
  elevation_ft?: number;
  iata_code?: string;
  icao_code?: string;
  intl_name?: string;
  local_name?: string;
  municipality?: string;
  timezone?: string;
};

type RawAirport = {
  continent?: string;
  country_id?: string;
  elevation_ft?: number;
  iata_code?: string;
  icao_code?: string;
  intl_name?: string;
  local_name?: string;
  municipality?: string;
  timezone?: string;
};

type WorldDataImportRequest = {
  airports?: RawAirport[];
};

export async function handleImportRequest(
  request: Request,
  url: URL,
  config: BffConfig,
): Promise<null | Response> {
  if (request.method === "POST" && url.pathname === "/import/world-data") {
    return importWorldData(request, config);
  }

  return null;
}

async function importWorldData(request: Request, config: BffConfig): Promise<Response> {
  const authError = await requireValidUserToken(request, config);

  if (authError) {
    return authError;
  }

  const payload = await readJson<WorldDataImportRequest>(request);
  const airports = (payload.airports ?? []).map(normalizeAirport);
  const adminToken = await getBackendAdminToken(config);
  const results = await Promise.all(
    airports.map(async (airport) => {
      const response = await fetch(`${config.backendBaseUrl}/airport`, {
        body: JSON.stringify(airport),
        headers: {
          Authorization: `Bearer ${adminToken}`,
          "Content-Type": "application/json",
        },
        method: "POST",
      });

      return {
        iata_code: airport.iata_code,
        ok: response.ok,
        status: response.status,
      };
    }),
  );

  return jsonResponse({
    imported: results.filter((result) => result.ok).length,
    results,
  });
}

function normalizeAirport(airport: RawAirport): NormalizedAirport {
  return {
    continent: airport.continent?.trim(),
    country_id: airport.country_id?.trim(),
    elevation_ft: airport.elevation_ft,
    iata_code: airport.iata_code?.trim().toUpperCase(),
    icao_code: airport.icao_code?.trim().toUpperCase(),
    intl_name: airport.intl_name?.trim(),
    local_name: airport.local_name?.trim(),
    municipality: airport.municipality?.trim(),
    timezone: airport.timezone?.trim(),
  };
}
