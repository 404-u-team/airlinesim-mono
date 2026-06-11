import { createApiClient, createAuthClient } from "@airlinesim/game-sdk";

import type { FinanceOverview, FinanceSummary, LedgerPage, LedgerTransaction, RouteProfitability } from "./types";

const authClient = createAuthClient();
const apiClient = createApiClient({ getToken: authClient.getAccessToken });

export async function getFinanceLedger(): Promise<{ summary: FinanceSummary; transactions: LedgerTransaction[] }> {
  return apiClient.get("/finance/ledger?limit=250");
}

export async function getFinanceOverview(): Promise<FinanceOverview> {
  return apiClient.get<FinanceOverview>("/finance/overview");
}

export async function getFinanceTransactions(input: {
  includeCapex: boolean;
  page: number;
  pageSize: number;
}): Promise<LedgerPage> {
  const search = new URLSearchParams({
    include_capex: input.includeCapex ? "1" : "0",
    limit: String(input.pageSize),
    offset: String((input.page - 1) * input.pageSize),
  });

  return apiClient.get(`/finance/ledger?${search.toString()}`);
}

export async function getRouteProfitability(): Promise<{ routes: RouteProfitability[] }> {
  return apiClient.get("/finance/routes");
}
