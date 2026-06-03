import type { BffConfig } from "../src/config";

import { invalidateBackendAdminToken } from "../src/auth";
import { cache } from "../src/modules/proxy";

export const config: BffConfig = {
  backendAdminLogin: "admin",
  backendAdminPassword: "password",
  backendBaseUrl: "http://backend.test",
  port: 4200,
};

export type FleetMockState = {
  aircraftPostCalls?: number;
  aircraftTypes?: Record<string, unknown>[];
  aircrafts?: Record<string, unknown>[];
  airline?: Record<string, unknown>;
  airports?: Record<string, unknown>[];
  countries?: Record<string, unknown>[];
  failAircraftPost?: boolean;
  patchTailNumber?: string;
};

export function authorizedRequest(url: string, init: RequestInit = {}): Request {
  return new Request(url, {
    ...init,
    headers: {
      Authorization: "Bearer user-token",
      ...Object.fromEntries(new Headers(init.headers).entries()),
    },
  });
}

export function installFleetFetch(state: FleetMockState = {}): void {
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    const method = init?.method ?? "GET";

    if (url === "http://backend.test/airline/me") {
      return json(state.airline ?? defaultAirline());
    }

    if (url === "http://backend.test/auth/login") {
      return json({ access_token: token() });
    }

    if (url === "http://backend.test/aircraft" && method === "POST") {
      state.aircraftPostCalls = (state.aircraftPostCalls ?? 0) + 1;
      return state.failAircraftPost ? json({ error: "backend down" }, 500) : json({ id: "aircraft-new" });
    }

    if (url.startsWith("http://backend.test/aircraft/") && method === "PATCH") {
      state.patchTailNumber = JSON.parse(String(init?.body)).tail_number as string;
      return json({ ok: true });
    }

    if (url === "http://backend.test/aircraft/aircraft-new" || url === "http://backend.test/aircraft/aircraft-1") {
      return json(findAircraft(state, url.endsWith("aircraft-new") ? "aircraft-new" : "aircraft-1"));
    }

    if (url === "http://backend.test/aircrafts") {
      return json({ items: state.aircrafts ?? [] });
    }

    if (url === "http://backend.test/aircraft-types") {
      return json({ items: state.aircraftTypes ?? defaultAircraftTypes() });
    }

    if (url === "http://backend.test/airports") {
      return json({ airports: state.airports ?? defaultAirports() });
    }

    if (url === "http://backend.test/countries") {
      return json({ countries: state.countries ?? defaultCountries() });
    }

    return json({ error: `unexpected ${method} ${url}` }, 500);
  };
}

export function resetFleetTestState(originalFetch: typeof fetch): void {
  globalThis.fetch = originalFetch;
  invalidateBackendAdminToken();
  cache.clear();
}

export function defaultAircraftTypes(): Record<string, unknown>[] {
  return [
    {
      cruising_speed_kph: 820,
      fuel_consumption_per_hour: 2500,
      iata_code: "32N",
      icao_code: "A20N",
      id: "type-good",
      maint_cost_per_flight_hour: 600,
      max_planned_seat_capacity: 180,
      max_range_km: 6300,
      min_runway_length_m: 1800,
      model_name: "Airbus A320neo",
      price_per_unit: 10_000_000,
    },
    {
      id: "type-expensive",
      max_planned_seat_capacity: 320,
      max_range_km: 11_000,
      min_runway_length_m: 3400,
      model_name: "Large Jet",
      price_per_unit: 90_000_000,
    },
  ];
}

export function defaultAirports(): Record<string, unknown>[] {
  return [
    {
      country_id: "country-kr",
      iata_code: "ICN",
      id: "airport-1",
      intl_name: "Incheon International",
      max_runway_length_m: 3750,
      max_runway_uses_per_day: 500,
      works_at_night: true,
    },
    {
      country_id: "country-kr",
      iata_code: "GMP",
      id: "airport-short",
      intl_name: "Short Field",
      max_runway_length_m: 1200,
      max_runway_uses_per_day: 40,
      works_at_night: false,
    },
  ];
}

export function defaultAirline(): Record<string, unknown> {
  return {
    balance: 30_000_000,
    id: "airline-1",
    name: "Seoul Air",
    starting_airport_id: "airport-1",
  };
}

function defaultCountries(): Record<string, unknown>[] {
  return [{ aircraft_tail_code: "HL", id: "country-kr", iso: "KR" }];
}

function findAircraft(state: FleetMockState, id: string): Record<string, unknown> {
  return (
    state.aircrafts?.find((aircraft) => aircraft.id === id) ?? {
      base_airport_id: "airport-1",
      current_maintenance_points: 90,
      id,
      max_maintenance_points_cached: 100,
      status: "ready",
      tail_number: "HL-001",
      total_cycles: 0,
      total_flight_hours: 0,
      type_id: "type-good",
    }
  );
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

function token(): string {
  const payload = btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 }))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");

  return `header.${payload}.signature`;
}
