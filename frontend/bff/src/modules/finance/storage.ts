/* eslint-disable @typescript-eslint/require-await -- storage API is async by contract over a synchronous SQLite store. */
import { resolve } from "node:path";

import type { LedgerTransaction } from "./types";

import { readDocument, writeDocument } from "../../db/database";

const ledgerLegacyPath = resolve(import.meta.dir, "../../../data/game-state/ledger.json");

export async function listLedgerForAirline(airlineId: string): Promise<LedgerTransaction[]> {
  return readLedger().filter((transaction) => transaction.airline_id === airlineId);
}

export async function saveLedgerTransactions(transactions: LedgerTransaction[]): Promise<LedgerTransaction[]> {
  const ledger = readLedger();
  const existingKeys = new Set(ledger.map((transaction) => transaction.idempotency_key));
  const additions = transactions.filter((transaction) => !existingKeys.has(transaction.idempotency_key));

  if (additions.length > 0) {
    writeDocument("ledger", [...ledger, ...additions]);
  }

  return additions;
}

function readLedger(): LedgerTransaction[] {
  return readDocument<LedgerTransaction[]>("ledger", [], ledgerLegacyPath);
}
