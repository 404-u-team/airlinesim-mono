import type { BffConfig } from "../../config";
import type { LedgerTransaction } from "../finance/types";
import type { Airport } from "../fleet/types";
import type { RoutePlanningSnapshot } from "../routes/planning";
import type { StoredRoute } from "../routes/types";

import { BackendHttpError } from "../../backend-http";
import { jsonResponse, readJson } from "../../http";
import { recordGameEvent } from "../events/producer";
import { signedAmount } from "../finance/calculator";
import { listLedgerForAirline, saveLedgerTransactions } from "../finance/storage";
import { loadRoutePlanningSnapshot } from "../routes/snapshot";
import { listRoutesForAirline } from "../routes/storage";
import { estimateHubFee } from "./fee";
import { addHub, listHubsForAirline, removeHub } from "./storage";

type HubsContext = {
  airlineId: string;
  airports: Airport[];
  baseAirportId: string;
  ledger: LedgerTransaction[];
  regions: RoutePlanningSnapshot["regions"];
  routes: StoredRoute[];
  snapshot: RoutePlanningSnapshot;
};

export async function handleHubsRequest(request: Request, url: URL, config: BffConfig): Promise<null | Response> {
  if (url.pathname !== "/hubs" && !url.pathname.startsWith("/hubs/")) {
    return null;
  }

  try {
    return await routeHubsRequest(request, url, config);
  } catch (error) {
    return hubError(error);
  }
}

async function addHubResponse(request: Request, config: BffConfig): Promise<Response> {
  const context = await loadHubsContext(request, config);
  const payload = await readJson<{ airport_id?: string }>(request);
  const airportId = payload.airport_id ?? "";
  const airport = context.airports.find((item) => item.id === airportId);

  if (!airport) {
    return jsonResponse({ error: { code: "AIRPORT_NOT_FOUND", message: "Airport not found." } }, { status: 404 });
  }
  if (airportId === context.baseAirportId) {
    return jsonResponse({ error: { code: "HUB_IS_BASE", message: "Base airport is already a hub." } }, { status: 409 });
  }
  const hubs = await listHubsForAirline(context.airlineId);
  if (hubs.some((hub) => hub.airport_id === airportId)) {
    return jsonResponse({ error: { code: "HUB_EXISTS", message: "Airport is already a hub." } }, { status: 409 });
  }

  const region = context.regions.find((item) => item.id === airport.region_id);
  const fee = estimateHubFee(airport, region);
  const available = availableBalance(context);
  if (available < fee) {
    return jsonResponse(
      { error: { code: "HUB_INSUFFICIENT_FUNDS", message: "Balance is not enough to establish this hub." } },
      { status: 402 },
    );
  }

  const now = new Date().toISOString();
  const hub = await addHub({ airline_id: context.airlineId, airport_id: airportId, created_at: now, fee });
  await saveLedgerTransactions([hubFeeTransaction(context.airlineId, airportId, fee, now)]);
  await recordGameEvent({
    airline_id: context.airlineId,
    category: "route",
    code: "HUB_ESTABLISHED",
    dedupe_key: `hub-established:${airportId}`,
    occurred_at: now,
    parameters: { airport: airportLabel(airport), fee },
    related: {},
    severity: "success",
    source_id: airportId,
    source_type: "system",
    target_path: "/airports/hubs",
  });

  return jsonResponse({ fee, hub }, { status: 201 });
}

function airportLabel(airport: Airport | undefined): string {
  if (!airport) {
    return "Airport";
  }

  return `${airport.iata_code ?? airport.icao_code ?? "----"} - ${airport.intl_name ?? airport.local_name ?? "Airport"}`;
}

function availableBalance(context: HubsContext): number {
  return (context.snapshot.airline.balance ?? 0) + context.ledger.reduce((sum, transaction) => sum + signedAmount(transaction), 0);
}

function hubError(error: unknown): Response {
  if (error instanceof BackendHttpError) {
    return jsonResponse(error.toNormalizedJson(), { status: error.status });
  }

  return jsonResponse(
    { error: { code: "HUB_ERROR", message: error instanceof Error ? error.message : "Hub request failed." } },
    { status: 500 },
  );
}

function hubFeeTransaction(airlineId: string, airportId: string, fee: number, now: string): LedgerTransaction {
  return {
    airline_id: airlineId,
    amount: fee,
    category: "airport",
    created_at: now,
    currency: "USD",
    direction: "debit",
    id: crypto.randomUUID(),
    idempotency_key: `hub-fee:${airlineId}:${airportId}`,
    label_code: "FINANCE_HUB_ESTABLISHMENT",
    occurred_at: now,
    source_type: "system_adjustment",
  };
}

function hubSummary(airportId: string, routes: StoredRoute[], ledger: LedgerTransaction[]): { profit: number; routes: number } {
  const routeIds = new Set(routes.filter((route) => route.origin_airport_id === airportId).map((route) => route.id));
  const profit = ledger
    .filter((transaction) => transaction.route_id && routeIds.has(transaction.route_id))
    .reduce((sum, transaction) => sum + signedAmount(transaction), 0);

  return { profit, routes: routeIds.size };
}

async function listHubsResponse(request: Request, config: BffConfig): Promise<Response> {
  const context = await loadHubsContext(request, config);
  const base = context.airports.find((item) => item.id === context.baseAirportId);
  const stored = await listHubsForAirline(context.airlineId);

  const hubs = [
    {
      airport_id: context.baseAirportId,
      created_at: "",
      fee: 0,
      is_base: true,
      label: airportLabel(base),
      ...hubSummary(context.baseAirportId, context.routes, context.ledger),
    },
    ...stored.map((hub) => ({
      airport_id: hub.airport_id,
      created_at: hub.created_at,
      fee: hub.fee,
      is_base: false,
      label: airportLabel(context.airports.find((item) => item.id === hub.airport_id)),
      ...hubSummary(hub.airport_id, context.routes, context.ledger),
    })),
  ];

  return jsonResponse({ hubs });
}

async function loadHubsContext(request: Request, config: BffConfig): Promise<HubsContext> {
  const snapshot = await loadRoutePlanningSnapshot(request, config);
  const airlineId = snapshot.airline.id ?? "";
  const [ledger, routes] = await Promise.all([listLedgerForAirline(airlineId), listRoutesForAirline(airlineId)]);

  return {
    airlineId,
    airports: snapshot.airports,
    baseAirportId: snapshot.airline.starting_airport_id ?? "",
    ledger,
    regions: snapshot.regions,
    routes,
    snapshot,
  };
}

async function removeHubResponse(request: Request, config: BffConfig, airportId: string): Promise<Response> {
  const context = await loadHubsContext(request, config);

  if (airportId === context.baseAirportId) {
    return jsonResponse({ error: { code: "HUB_IS_BASE", message: "Base hub cannot be removed." } }, { status: 409 });
  }
  const removed = await removeHub(context.airlineId, airportId);

  return jsonResponse({ removed });
}

async function routeHubsRequest(request: Request, url: URL, config: BffConfig): Promise<Response> {
  if (request.method === "GET" && url.pathname === "/hubs") {
    return listHubsResponse(request, config);
  }
  if (request.method === "POST" && url.pathname === "/hubs") {
    return addHubResponse(request, config);
  }
  const match = /^\/hubs\/([^/]+)$/.exec(url.pathname);
  if (request.method === "DELETE" && match?.[1]) {
    return removeHubResponse(request, config, decodeURIComponent(match[1]));
  }

  return jsonResponse({ error: { code: "HUB_NOT_FOUND", message: "Hub endpoint not found." } }, { status: 404 });
}
