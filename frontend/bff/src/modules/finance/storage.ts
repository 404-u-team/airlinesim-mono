import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import type { LedgerTransaction } from "./types";

const ledgerPath = resolve(import.meta.dir, "../../../data/game-state/ledger.json");
let ledgerMutationQueue: Promise<unknown> = Promise.resolve();

export async function listLedgerForAirline(airlineId: string): Promise<LedgerTransaction[]> {
  const ledger = await readLedger();

  return ledger.filter((transaction) => transaction.airline_id === airlineId);
}

export async function saveLedgerTransactions(transactions: LedgerTransaction[]): Promise<LedgerTransaction[]> {
  return queuedLedgerMutation(async () => {
    const ledger = await readLedger();
    const existingKeys = new Set(ledger.map((transaction) => transaction.idempotency_key));
    const additions = transactions.filter((transaction) => !existingKeys.has(transaction.idempotency_key));

    if (additions.length > 0) {
      await writeLedger([...ledger, ...additions]);
    }

    return additions;
  });
}

async function queuedLedgerMutation<TValue>(mutation: () => Promise<TValue>): Promise<TValue> {
  const next = ledgerMutationQueue.then(mutation, mutation);
  ledgerMutationQueue = next.catch(() => undefined);

  return next;
}

async function readLedger(): Promise<LedgerTransaction[]> {
  try {
    const payload = JSON.parse(await readFile(ledgerPath, "utf8")) as unknown;

    return Array.isArray(payload) ? (payload as LedgerTransaction[]) : [];
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

async function writeLedger(value: LedgerTransaction[]): Promise<void> {
  await mkdir(dirname(ledgerPath), { recursive: true });
  const tmpPath = `${ledgerPath}.${crypto.randomUUID()}.tmp`;
  await writeFile(tmpPath, JSON.stringify(value, null, 2));
  await rename(tmpPath, ledgerPath);
}
