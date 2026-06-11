import type { StoredFlight } from "../operations/types";
import type { LedgerTransaction } from "./types";

import { consumeFuelForFlights, type FuelConsumption } from "../fuel/fuel-storage";
import { getCurrentFuelUnitPrice } from "../fuel/price";
import { buildFlightTransactions } from "./calculator";
import { saveLedgerTransactions } from "./storage";

export async function reconcileCompletedFlight(flight: StoredFlight): Promise<LedgerTransaction[]> {
  return reconcileCompletedFlights([flight]);
}

// Settles departed flights into the ledger. The fuel debit is storage-aware: tonnes
// already sitting in the airline's tank were paid for at purchase time, so only the
// spot-bought shortfall is charged here.
export async function reconcileCompletedFlights(flights: StoredFlight[]): Promise<LedgerTransaction[]> {
  const settleable = flights
    .map((flight) => ({ flight, transactions: buildFlightTransactions(flight) }))
    .filter((item) => item.transactions.length > 0);

  const byAirline = new Map<string, typeof settleable>();
  for (const item of settleable) {
    byAirline.set(item.flight.airline_id, [...(byAirline.get(item.flight.airline_id) ?? []), item]);
  }

  const perAirline = await Promise.all([...byAirline.entries()].map(async ([airlineId, items]) => {
    const consumptions = await consumeFuelForFlights(
      airlineId,
      items.map(({ flight }) => ({ flightId: flight.id, tonnes: fuelTonnesFor(flight) })),
    );

    return items.flatMap(({ flight, transactions: base }) => withStorageAwareFuelCost(base, consumptions.get(flight.id)));
  }));

  return saveLedgerTransactions(perAirline.flat());
}

function fuelTonnesFor(flight: StoredFlight): number {
  const financials = flight.actual ?? flight.expected;
  if (financials.fuel_tonnes !== undefined) {
    return financials.fuel_tonnes;
  }

  // Legacy flights lack the tonnage; reconstruct it from the heuristic fuel share of
  // the cost at the current price, matching what buildFlightTransactions debits.
  return Math.round(financials.cost * 0.55) / Math.max(getCurrentFuelUnitPrice(), 1);
}

function withStorageAwareFuelCost(base: LedgerTransaction[], consumption: FuelConsumption | undefined): LedgerTransaction[] {
  if (!consumption) {
    return base;
  }

  return base.map((transaction) =>
    transaction.source_type === "fuel_cost"
      ? {
          ...transaction,
          amount: Math.max(0, Math.round(consumption.spot_tonnes * consumption.spot_price_per_tonne)),
          parameters: {
            from_storage_tonnes: consumption.from_storage_tonnes,
            spot_price_per_tonne: consumption.spot_price_per_tonne,
            spot_tonnes: consumption.spot_tonnes,
          },
        }
      : transaction);
}
