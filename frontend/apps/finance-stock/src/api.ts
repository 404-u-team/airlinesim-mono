import { createApiClient, createAuthClient } from "@airlinesim/game-sdk";

import type { FinanceOverview, FinanceSummary, LedgerTransaction, RouteProfitability } from "./types";

const authClient = createAuthClient();
const apiClient = createApiClient({ getToken: authClient.getAccessToken });

export async function getFinanceLedger(): Promise<{ summary: FinanceSummary; transactions: LedgerTransaction[] }> {
  return apiClient.get("/finance/ledger?limit=250");
}

export async function getFinanceOverview(): Promise<FinanceOverview> {
  return apiClient.get<FinanceOverview>("/finance/overview");
}

export async function getRouteProfitability(): Promise<{ routes: RouteProfitability[] }> {
  return apiClient.get("/finance/routes");
}
