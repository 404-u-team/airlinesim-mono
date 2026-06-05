import type { BffConfig } from "../../config";
import type { FleetSnapshot } from "../fleet/types";
import type { StoredFlight } from "../operations/types";
import type { StoredRoute } from "../routes/types";
import type { LedgerTransaction } from "./types";

import { BackendHttpError } from "../../backend-http";
import { jsonResponse } from "../../http";
import { loadFleetSnapshot } from "../fleet/snapshot";
import { getOperationsStateForRequest } from "../operations";
import { listRoutesForAirline } from "../routes/storage";
import { buildFinanceRisks, signedAmount, sumLedger } from "./calculator";
import { reconcileCompletedFlights } from "./ledger";
import { listLedgerForAirline } from "./storage";

type FinanceSnapshot = {
  fleet: FleetSnapshot;
  flights: StoredFlight[];
  ledger: LedgerTransaction[];
  routes: StoredRoute[];
};

type FinanceSummary = {
  costs: number;
  profit: number;
  revenue: number;
};

type RouteProfitability = FinanceSummary & {
  destination_airport_id: string;
  destination_airport_label: string;
  flights_completed: number;
  origin_airport_id: string;
  origin_airport_label: string;
  recommendation: "healthy" | "insufficient_data" | "review";
  route_id: string;
};

// The endpoint router intentionally keeps all finance paths in one BFF module.
// eslint-disable-next-line complexity
export async function handleFinanceRequest(
  request: Request,
  url: URL,
  config: BffConfig,
): Promise<null | Response> {
  if (!url.pathname.startsWith("/finance/")) {
    return null;
  }

  try {
    if (request.method === "GET" && url.pathname === "/finance/overview") {
      return await overview(request, config);
    }
    if (request.method === "GET" && url.pathname === "/finance/ledger") {
      return await ledger(request, url, config);
    }
    if (request.method === "GET" && url.pathname === "/finance/routes") {
      return await routes(request, config);
    }
    const flightMatch = /^\/finance\/flights\/([^/]+)$/.exec(url.pathname);
    if (request.method === "GET" && flightMatch?.[1]) {
      return await flightDetail(request, config, decodeURIComponent(flightMatch[1]));
    }
    if (request.method === "POST" && url.pathname === "/finance/recalculate") {
      const snapshot = await loadFinanceSnapshot(request, config);
      const additions = await reconcileCompletedFlights(snapshot.flights);
      return jsonResponse({ added: additions.length, transactions: additions });
    }

    return jsonResponse({ error: { code: "FINANCE_NOT_FOUND", message: "Finance endpoint not found." } }, { status: 404 });
  } catch (error) {
    return financeError(error);
  }
}

function airportLabel(airport: FleetSnapshot["airports"][number] | undefined, fallback: string): string {
  if (!airport) {
    return fallback;
  }

  return `${airport.iata_code ?? airport.icao_code ?? "----"} - ${airport.intl_name ?? airport.local_name ?? "Airport"}`;
}

function financeError(error: unknown): Response {
  if (error instanceof BackendHttpError) {
    return jsonResponse(error.toNormalizedJson(), { status: error.status });
  }
  return jsonResponse(
    { error: { code: "FINANCE_ERROR", message: error instanceof Error ? error.message : "Finance request failed." } },
    { status: 500 },
  );
}

async function flightDetail(request: Request, config: BffConfig, flightId: string): Promise<Response> {
  const snapshot = await loadFinanceSnapshot(request, config);
  const flight = snapshot.flights.find((item) => item.id === flightId);
  if (!flight) {
    return jsonResponse({ error: { code: "FLIGHT_NOT_FOUND", message: "Flight not found." } }, { status: 404 });
  }
  const transactions = snapshot.ledger.filter((transaction) => transaction.flight_id === flightId);

  return jsonResponse({ flight, profit: sumLedger(transactions), transactions });
}

function inWindow(transactions: LedgerTransaction[], days: number): LedgerTransaction[] {
  const start = Date.now() - days * 24 * 60 * 60_000;

  return transactions.filter((transaction) => new Date(transaction.occurred_at).getTime() >= start);
}

async function ledger(request: Request, url: URL, config: BffConfig): Promise<Response> {
  const snapshot = await loadFinanceSnapshot(request, config);
  const category = url.searchParams.get("category");
  const routeId = url.searchParams.get("route_id");
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? "100"), 1), 500);
  const transactions = snapshot.ledger
    .filter((item) => !category || item.category === category)
    .filter((item) => !routeId || item.route_id === routeId)
    .sort((left, right) => right.occurred_at.localeCompare(left.occurred_at))
    .slice(0, limit);

  return jsonResponse({
    summary: summarize(transactions),
    transactions,
  });
}

async function loadFinanceSnapshot(request: Request, config: BffConfig): Promise<FinanceSnapshot> {
  const [fleet, operations] = await Promise.all([
    loadFleetSnapshot(request, config),
    getOperationsStateForRequest(request, config),
  ]);
  await reconcileCompletedFlights(operations.flights);
  const airlineId = fleet.airline.id ?? "";
  const [ledgerTransactions, storedRoutes] = await Promise.all([
    listLedgerForAirline(airlineId),
    listRoutesForAirline(airlineId),
  ]);

  return { fleet, flights: operations.flights, ledger: ledgerTransactions, routes: storedRoutes };
}

async function overview(request: Request, config: BffConfig): Promise<Response> {
  const snapshot = await loadFinanceSnapshot(request, config);
  const routeProfits = routeProfitability(snapshot.ledger, snapshot.routes, snapshot.fleet.airports);
  const weekly = inWindow(snapshot.ledger, 7);
  const today = inWindow(snapshot.ledger, 1);
  const ledgerDelta = sumLedger(snapshot.ledger);
  const baselineBalance = snapshot.fleet.airline.balance ?? 0;
  const availableBalance = baselineBalance + ledgerDelta;
  const typeById = new Map(snapshot.fleet.aircraftTypes.map((type) => [type.id, type]));
  const fleetValue = snapshot.fleet.aircrafts.reduce((total, aircraft) => total + (typeById.get(aircraft.type_id)?.price_per_unit ?? 0), 0);
  const weeklySummary = summarize(weekly);

  return jsonResponse({
    airline: snapshot.fleet.airline,
    balance: {
      available: availableBalance,
      backend_baseline: baselineBalance,
      operations_delta: ledgerDelta,
    },
    metrics: {
      completed_flights: snapshot.flights.filter((flight) => flight.status === "completed").length,
      fleet_value: fleetValue,
      today: summarize(today),
      weekly: weeklySummary,
    },
    recent_transactions: snapshot.ledger.slice().sort((left, right) => right.occurred_at.localeCompare(left.occurred_at)).slice(0, 12),
    risks: buildFinanceRisks(availableBalance, weeklySummary.profit, Boolean(snapshot.fleet.airline.is_bankrupt), routeProfits),
    route_profitability: routeProfits,
  });
}

function recommendationForProfit(profit: number): RouteProfitability["recommendation"] {
  if (profit < 0) {
    return "review";
  }
  if (profit > 0) {
    return "healthy";
  }
  return "insufficient_data";
}

function routeProfitability(
  transactions: LedgerTransaction[],
  routesList: StoredRoute[],
  airports: FleetSnapshot["airports"] = [],
): RouteProfitability[] {
  const airportById = new Map(airports.map((airport) => [airport.id, airport]));

  return routesList.map((route) => {
    const routeTransactions = transactions.filter((transaction) => transaction.route_id === route.id);
    const flightIds = new Set(routeTransactions.map((transaction) => transaction.flight_id).filter(Boolean));
    const summary = summarize(routeTransactions);

    return {
      destination_airport_id: route.destination_airport_id,
      destination_airport_label: airportLabel(airportById.get(route.destination_airport_id), route.destination_airport_id),
      flights_completed: flightIds.size,
      origin_airport_id: route.origin_airport_id,
      origin_airport_label: airportLabel(airportById.get(route.origin_airport_id), route.origin_airport_id),
      recommendation: recommendationForProfit(summary.profit),
      route_id: route.id,
      ...summary,
    };
  });
}

async function routes(request: Request, config: BffConfig): Promise<Response> {
  const snapshot = await loadFinanceSnapshot(request, config);

  return jsonResponse({ routes: routeProfitability(snapshot.ledger, snapshot.routes, snapshot.fleet.airports) });
}

function summarize(transactions: LedgerTransaction[]): FinanceSummary {
  const revenue = transactions.filter((item) => item.direction === "credit").reduce((total, item) => total + item.amount, 0);
  const costs = transactions.filter((item) => item.direction === "debit").reduce((total, item) => total + item.amount, 0);

  return {
    costs,
    profit: transactions.reduce((total, item) => total + signedAmount(item), 0),
    revenue,
  };
}
