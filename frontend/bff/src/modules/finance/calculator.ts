import type { StoredFlight } from "../operations/types";
import type { FinanceRisk, LedgerTransaction } from "./types";

import { hasDeparted } from "../operations/settlement";

export function buildFinanceRisks(
  availableBalance: number,
  weeklyProfit: number,
  isBankrupt: boolean,
  routeProfits: Array<{ profit: number; route_id: string }>,
): FinanceRisk[] {
  const risks: FinanceRisk[] = [];

  if (isBankrupt) {
    risks.push({ code: "BANKRUPTCY_FLAG", severity: "danger", target_path: "/finances/overview" });
  }
  if (availableBalance < 5_000_000) {
    risks.push({ code: "LOW_BALANCE", severity: "danger", target_path: "/finances/costs", value: availableBalance });
  }
  if (weeklyProfit < 0) {
    risks.push({ code: "WEEKLY_OPERATING_LOSS", severity: "warning", target_path: "/finances/profit", value: weeklyProfit });
  }
  const lossRoute = routeProfits.find((route) => route.profit < 0);
  if (lossRoute) {
    risks.push({ code: "ROUTE_LOSS", severity: "warning", target_path: `/airports/routes?route_id=${encodeURIComponent(lossRoute.route_id)}`, value: lossRoute.profit });
  }

  return risks;
}

export function buildFlightTransactions(flight: StoredFlight): LedgerTransaction[] {
  // Revenue and costs are recognised at departure, not arrival.
  if (!hasDeparted(flight)) {
    return [];
  }

  const financials = flight.actual ?? flight.expected;
  const occurredAt = flight.departure_at;
  const cost = Math.max(financials.cost, 0);
  const parts = {
    airport: Math.round(cost * 0.25),
    fuel: Math.round(cost * 0.55),
  };
  const maintenance = Math.max(0, cost - parts.airport - parts.fuel);

  return [
    transaction(flight, "flight_revenue", "revenue", "FINANCE_FLIGHT_REVENUE", financials.revenue, "credit", occurredAt),
    transaction(flight, "fuel_cost", "fuel", "FINANCE_FUEL_COST", parts.fuel, "debit", occurredAt),
    transaction(flight, "airport_fee", "airport", "FINANCE_AIRPORT_FEES", parts.airport, "debit", occurredAt),
    transaction(flight, "maintenance_reserve", "maintenance", "FINANCE_MAINTENANCE_RESERVE", maintenance, "debit", occurredAt),
  ];
}

export function signedAmount(transaction: LedgerTransaction): number {
  return transaction.direction === "credit" ? transaction.amount : -transaction.amount;
}

export function sumLedger(transactions: LedgerTransaction[]): number {
  return transactions.reduce(
    (total, transaction) => total + (transaction.excluded_from_balance ? 0 : signedAmount(transaction)),
    0,
  );
}

function stableLedgerId(idempotencyKey: string): string {
  const hash = idempotencyKey.split("").reduce((value, char) => (value << 5) - value + char.charCodeAt(0), 0);

  return `ledger-${Math.abs(hash).toString(36)}`;
}

function transaction(
  flight: StoredFlight,
  sourceType: LedgerTransaction["source_type"],
  category: LedgerTransaction["category"],
  labelCode: string,
  amount: number,
  direction: LedgerTransaction["direction"],
  occurredAt: string,
): LedgerTransaction {
  const idempotencyKey = `flight:${flight.id}:${sourceType}`;

  return {
    airline_id: flight.airline_id,
    amount: Math.max(0, Math.round(amount)),
    category,
    created_at: new Date().toISOString(),
    currency: "USD",
    direction,
    flight_id: flight.id,
    id: stableLedgerId(idempotencyKey),
    idempotency_key: idempotencyKey,
    label_code: labelCode,
    occurred_at: occurredAt,
    route_id: flight.route_id,
    schedule_id: flight.schedule_id,
    source_id: flight.id,
    source_type: sourceType,
  };
}
