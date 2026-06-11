import type { BffConfig } from "../../config";
import type { Airport, BackendAirline, CreateAirlineRequest, OnboardingAirportOption } from "./types";

import { getBackendAdminToken, getUserAuthorization, requireValidUserToken } from "../../auth";
import { BackendHttpError, requestBackendJson } from "../../backend-http";
import { jsonResponse, readJson } from "../../http";
import { getCachedListInternal } from "../proxy";
import { calculateAirportScore } from "./airport-scoring";

export async function handleCreateOnboardingAirline(request: Request, config: BffConfig): Promise<Response> {
  const authorization = getUserAuthorization(request) ?? "";

  try {
    const body = await readJson<CreateAirlineRequest>(request);

    const validationError = validateCreateAirlinePayload(body);
    if (validationError) {
      return formatValidationResponse(validationError.error);
    }

    const name = (body.name ?? "").trim();
    const iataCode = (body.iata_code ?? "").trim().toUpperCase();
    const icaoCode = (body.icao_code ?? "").trim().toUpperCase();
    const startingAirportId = (body.starting_airport_id ?? "").trim();

    const startingAirport = await verifyStartingAirport(request, config, startingAirportId);
    if (!startingAirport) {
      return formatValidationResponse("Selected starting airport does not exist.");
    }

    const response = await requestBackendJson<BackendAirline>(config, "/airline", {
      body: {
        iata_code: iataCode,
        icao_code: icaoCode,
        name,
        starting_airport_id: startingAirportId,
      },
      method: "POST",
      token: authorization,
    });

    const calculatedAirportCard = calculateAirportScore(startingAirport);

    return jsonResponse({
      airline: {
        iata_code: iataCode,
        icao_code: icaoCode,
        id: response.id,
        name,
        starting_airport_id: startingAirportId,
      },
      recommendedNextRoute: "/fleet/overview",
      startingAirport: calculatedAirportCard,
    });
  } catch (error) {
    return handleOnboardingError(error);
  }
}

export async function handleOnboardingAirports(
  request: Request,
  url: URL,
  config: BffConfig,
): Promise<Response> {
  const q = url.searchParams.get("q")?.trim().toLowerCase();
  const countryId = url.searchParams.get("country_id");
  const regionId = url.searchParams.get("region_id");
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") ?? "20")));

  try {
    const [airports, countryIndex] = await Promise.all([
      getOnboardingAirportsCatalog(request, config),
      // Country names are a nice-to-have label; never block airport search on it.
      getOnboardingCountriesIndex(request, config).catch(() => new Map<string, string>()),
    ]);
    const options: OnboardingAirportOption[] = [];

    for (const airport of airports) {
      if (!shouldKeepAirport(airport, q, countryId, regionId)) {
        continue;
      }

      const option = calculateAirportScore(airport);
      option.country_name = option.country_id ? countryIndex.get(option.country_id) : undefined;

      if (q) {
        option.score += getQueryScoreAdjustment(airport, q);
      }

      options.push(option);
    }

    options.sort((a, b) => b.score - a.score);

    return jsonResponse({
      airports: options.slice(0, limit),
    });
  } catch (error) {
    return handleOnboardingError(error);
  }
}

export async function handleOnboardingRequest(
  request: Request,
  url: URL,
  config: BffConfig,
): Promise<null | Response> {
  if (!url.pathname.startsWith("/onboarding/")) {
    return null;
  }

  if (url.pathname === "/onboarding/session" && request.method === "GET") {
    return handleOnboardingSession(request, config);
  }

  const authError = await requireValidUserToken(request, config);
  if (authError) {
    return authError;
  }

  if (url.pathname === "/onboarding/airports" && request.method === "GET") {
    return handleOnboardingAirports(request, url, config);
  }

  if (url.pathname === "/onboarding/airline" && request.method === "POST") {
    return handleCreateOnboardingAirline(request, config);
  }

  return null;
}

export async function handleOnboardingSession(request: Request, config: BffConfig): Promise<Response> {
  const authorization = getUserAuthorization(request);

  if (!authorization) {
    return jsonResponse({
      airlineExists: false,
      authenticated: false,
      onboardingStep: "AUTH_REQUIRED",
      recommendedNextRoute: "/login",
    });
  }

  try {
    const airline = await fetchSessionAirline(config, authorization);
    if (!airline) {
      return jsonResponse({
        airlineExists: false,
        authenticated: true,
        onboardingStep: "AIRLINE_REQUIRED",
        recommendedNextRoute: "/onboarding/airline",
      });
    }

    const startingAirport = await getSessionStartingAirport(request, config, airline.starting_airport_id);
    const recommendedNextRoute = await getSessionNextRoute(config, authorization);

    return jsonResponse({
      airline: {
        iata_code: airline.iata_code,
        icao_code: airline.icao_code,
        id: airline.id,
        name: airline.name,
        starting_airport_id: airline.starting_airport_id,
      },
      airlineExists: true,
      authenticated: true,
      onboardingStep: "READY",
      recommendedNextRoute,
      startingAirport,
    });
  } catch (error) {
    return handleOnboardingError(error);
  }
}

async function fetchSessionAirline(config: BffConfig, token: string): Promise<BackendAirline | null> {
  try {
    return await requestBackendJson<BackendAirline>(config, "/airline/me", { token });
  } catch (error) {
    if (error instanceof BackendHttpError && error.status === 404) {
      return null;
    }
    throw error;
  }
}

function formatValidationResponse(message: string): Response {
  return jsonResponse(
    {
      error: {
        code: "AIRLINE_VALIDATION_FAILED",
        message,
        retryable: false,
      },
    },
    { status: 400 },
  );
}

async function getOnboardingAirportsCatalog(request: Request, config: BffConfig): Promise<Airport[]> {
  const token = await getBackendAdminToken(config);
  const adminRequest = new Request(request.url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return getCachedListInternal<Airport>(adminRequest, config, "/airports", "airports");
}

async function getOnboardingCountriesIndex(request: Request, config: BffConfig): Promise<Map<string, string>> {
  const token = await getBackendAdminToken(config);
  const adminRequest = new Request(request.url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  const countries = await getCachedListInternal<{ id?: string; intl_name?: string; local_name?: string }>(
    adminRequest,
    config,
    "/countries",
    "countries",
  );
  const index = new Map<string, string>();

  for (const country of countries) {
    const name = country.intl_name ?? country.local_name;
    if (country.id && name) {
      index.set(country.id, name);
    }
  }

  return index;
}

function getQueryScoreAdjustment(airport: Airport, q: string): number {
  const matchesIata = airport.iata_code?.toLowerCase() === q;
  const matchesIcao = airport.icao_code?.toLowerCase() === q;

  if (matchesIata) {
    return 10000;
  }
  if (matchesIcao) {
    return 5000;
  }
  return 500;
}

async function getSessionNextRoute(config: BffConfig, token: string): Promise<string> {
  try {
    const aircrafts = await requestBackendJson<{ items?: unknown[] }>(config, "/aircrafts", { token });
    if (!aircrafts.items || aircrafts.items.length === 0) {
      return "/fleet/overview";
    }
  } catch {
    // ignore
  }
  return "/dashboard";
}

async function getSessionStartingAirport(
  request: Request,
  config: BffConfig,
  startingAirportId?: string,
): Promise<null | OnboardingAirportOption> {
  if (!startingAirportId) {
    return null;
  }
  try {
    const airports = await getOnboardingAirportsCatalog(request, config);
    const found = airports.find((a) => a.id === startingAirportId);
    return found ? calculateAirportScore(found) : null;
  } catch {
    return null;
  }
}

function handleOnboardingError(error: unknown): Response {
  if (error instanceof BackendHttpError) {
    if (error.status === 401 || error.status === 403) {
      return jsonResponse(
        {
          airlineExists: false,
          authenticated: false,
          onboardingStep: "AUTH_REQUIRED",
          recommendedNextRoute: "/login",
        },
        { status: 401 },
      );
    }
    return jsonResponse(error.toNormalizedJson(), { status: error.status });
  }
  return jsonResponse(
    {
      error: {
        code: "BACKEND_UNAVAILABLE",
        message: error instanceof Error ? error.message : String(error),
        retryable: true,
      },
    },
    { status: 503 },
  );
}

function matchesSearchQuery(airport: Airport, q: string): boolean {
  const matchesIata = airport.iata_code?.toLowerCase() === q;
  const matchesIcao = airport.icao_code?.toLowerCase() === q;
  const matchesName =
    Boolean(airport.intl_name?.toLowerCase().includes(q)) ||
    Boolean(airport.local_name?.toLowerCase().includes(q));
  const matchesCity = Boolean(airport.municipality?.toLowerCase().includes(q));

  return matchesIata || matchesIcao || matchesName || matchesCity;
}

function shouldKeepAirport(
  airport: Airport,
  q: string | undefined,
  countryId: null | string,
  regionId: null | string,
): boolean {
  if (countryId && airport.country_id !== countryId) {
    return false;
  }
  if (regionId && airport.region_id !== regionId) {
    return false;
  }
  if (q && !matchesSearchQuery(airport, q)) {
    return false;
  }
  return true;
}

function validateCreateAirlinePayload(body: CreateAirlineRequest): null | { error: string } {
  const name = (body.name ?? "").trim();
  const iataCode = (body.iata_code ?? "").trim().toUpperCase();
  const icaoCode = (body.icao_code ?? "").trim().toUpperCase();
  const startingAirportId = (body.starting_airport_id ?? "").trim();

  if (!name) {
    return { error: "Airline name cannot be empty." };
  }
  if (iataCode.length !== 2 || !/^[A-Z0-9]{2}$/.test(iataCode)) {
    return { error: "IATA code must be exactly 2 alphanumeric characters." };
  }
  if (icaoCode.length !== 3 || !/^[A-Z]{3}$/.test(icaoCode)) {
    return { error: "ICAO code must be exactly 3 letters." };
  }
  if (!startingAirportId) {
    return { error: "Starting airport must be selected." };
  }
  return null;
}

async function verifyStartingAirport(request: Request, config: BffConfig, id: string): Promise<Airport | null> {
  const airports = await getOnboardingAirportsCatalog(request, config);
  return airports.find((a) => a.id === id) ?? null;
}
