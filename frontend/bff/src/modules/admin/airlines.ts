import type { BffConfig } from "../../config";
import type { LedgerTransaction } from "../finance/types";

import { getBackendAdminToken } from "../../auth";
import { requestBackendJson } from "../../backend-http";
import { jsonResponse, readJson } from "../../http";
import { sumLedger } from "../finance/calculator";
import { listLedgerForAirline, saveLedgerTransactions } from "../finance/storage";
import { listAirlineRegistry } from "./airline-registry";
import { adminActorId, recordAdminAudit } from "./audit";

type CreditRequest = {
  amount?: number;
  note?: string;
};

// Routes the admin airline-management endpoints. Returns null for non-matching paths
// so the caller can fall through to other admin handlers.
export async function handleAdminAirlinesRequest(request: Request, url: URL, config: BffConfig): Promise<null | Response> {
  if (request.method === "GET" && url.pathname === "/admin/airlines") {
    return listAirlines();
  }

  const creditMatch = /^\/admin\/airlines\/([^/]+)\/credit$/.exec(url.pathname);
  if (request.method === "POST" && creditMatch?.[1]) {
    return creditAirline(request, decodeURIComponent(creditMatch[1]), config);
  }

  const detailMatch = /^\/admin\/airlines\/([^/]+)$/.exec(url.pathname);
  if (request.method === "GET" && detailMatch?.[1]) {
    return getAirlineDetail(config, decodeURIComponent(detailMatch[1]));
  }

  return null;
}

function adjustmentTransaction(airlineId: string, amount: number, note: string | undefined): LedgerTransaction {
  const now = new Date().toISOString();

  return {
    airline_id: airlineId,
    amount: Math.abs(amount),
    category: "system",
    created_at: now,
    currency: "USD",
    direction: amount > 0 ? "credit" : "debit",
    id: `ledger-${crypto.randomUUID()}`,
    idempotency_key: `admin-adjustment:${airlineId}:${crypto.randomUUID()}`,
    label_code: note ? `ADMIN_ADJUSTMENT:${note}` : "ADMIN_ADJUSTMENT",
    occurred_at: now,
    source_id: airlineId,
    source_type: "system_adjustment",
  };
}

async function creditAirline(request: Request, airlineId: string, config: BffConfig): Promise<Response> {
  const payload = await readJson<CreditRequest>(request);
  const amount = Math.round(payload.amount ?? 0);

  if (!Number.isFinite(amount) || amount === 0) {
    return jsonResponse({ error: { code: "INVALID_AMOUNT", message: "A non-zero amount is required." } }, { status: 400 });
  }

  const transaction = adjustmentTransaction(airlineId, amount, payload.note);
  await saveLedgerTransactions([transaction]);
  await recordAdminAudit({
    action: amount > 0 ? "airline.credit" : "airline.debit",
    capability: "world.manage",
    entity_id: airlineId,
    entity_type: "airline",
    success: true,
    user_id: adminActorId(request),
  });

  // Sync balance to the backend PostgreSQL so that subsequent operations
  // (e.g. aircraft purchase) pass the backend's own balance check.
  await syncBalanceToBackend(config, airlineId, amount);

  const ledger = await listLedgerForAirline(airlineId);

  return jsonResponse({ operations_delta: sumLedger(ledger), transaction });
}

// Fetches backend airline details by id; returns null if the backend has no such
// endpoint or the lookup fails, so the admin still sees the registry + ledger data.
async function fetchBackendAirline(config: BffConfig, airlineId: string): Promise<unknown> {
  try {
    const token = await getBackendAdminToken(config);

    return await requestBackendJson(config, `/airline/${encodeURIComponent(airlineId)}`, { token });
  } catch {
    return null;
  }
}

async function getAirlineDetail(config: BffConfig, airlineId: string): Promise<Response> {
  const ledger = await listLedgerForAirline(airlineId);
  const registry = (await listAirlineRegistry()).find((entry) => entry.id === airlineId) ?? null;
  const backend = await fetchBackendAirline(config, airlineId);

  return jsonResponse({ airline: backend, operations_delta: sumLedger(ledger), registry });
}

async function listAirlines(): Promise<Response> {
  return jsonResponse({ airlines: await listAirlineRegistry() });
}

/**
 * Calls the admin-only POST /airline/:id/adjust-balance endpoint on the backend
 * so that the PostgreSQL balance stays in sync with the BFF ledger delta.
 *
 * - 4xx responses are re-thrown (wrong data or permission issues must surface).
 * - 5xx / network errors are logged as warnings but do not block the BFF ledger
 *   write, since the backend may be temporarily unavailable.
 */
async function syncBalanceToBackend(config: BffConfig, airlineId: string, amount: number): Promise<void> {
  try {
    const token = await getBackendAdminToken(config);
    await requestBackendJson(config, `/airline/${encodeURIComponent(airlineId)}/adjust-balance`, {
      body: { amount },
      method: "POST",
      token,
    });
  } catch (err) {
    const status = (err as { status?: number }).status ?? 0;
    if (status >= 400 && status < 500) {
      // Client errors (404, 403, 400) indicate a real problem — propagate.
      throw err;
    }
    // Server errors or network failures: log but do not block the ledger write.
    console.warn(`[admin/airlines] Backend balance sync failed for ${airlineId} (amount=${String(amount)}):`, err);
  }
}
