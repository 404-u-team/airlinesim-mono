import type { StoredFlight } from "../operations/types";
import type { LedgerTransaction } from "./types";

import { buildFlightTransactions } from "./calculator";
import { saveLedgerTransactions } from "./storage";

export async function reconcileCompletedFlight(flight: StoredFlight): Promise<LedgerTransaction[]> {
  return saveLedgerTransactions(buildFlightTransactions(flight));
}

export async function reconcileCompletedFlights(flights: StoredFlight[]): Promise<LedgerTransaction[]> {
  return saveLedgerTransactions(flights.flatMap(buildFlightTransactions));
}
