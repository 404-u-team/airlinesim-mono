import { expect, test } from "bun:test";

import { writeDocument } from "../src/db/database";
import { listLedgerForAirline } from "../src/modules/finance/storage";
import {
  consumeFuelForFlights,
  FUEL_STORAGE_CAPACITY_TONNES,
  FuelStorageError,
  getFuelStorageSnapshot,
  purchaseFuel,
} from "../src/modules/fuel/fuel-storage";

test("purchaseFuel stores tonnes, records history and debits the ledger", async () => {
  resetStores();
  const result = await purchaseFuel("airline-fuel-1", 500);

  expect(result.cost).toBe(Math.round(500 * result.price_per_tonne));
  expect(result.snapshot.stored_tonnes).toBe(500);
  expect(result.snapshot.average_purchase_price).toBe(result.price_per_tonne);
  expect(result.snapshot.history[0]?.reason).toBe("purchase");

  const ledger = await listLedgerForAirline("airline-fuel-1");
  expect(ledger).toHaveLength(1);
  expect(ledger[0]?.label_code).toBe("FINANCE_FUEL_PURCHASE");
  expect(ledger[0]?.direction).toBe("debit");
  expect(ledger[0]?.amount).toBe(result.cost);
});

test("purchaseFuel rejects invalid amounts and over-capacity purchases", async () => {
  resetStores();
  expect(purchaseFuel("airline-fuel-2", 0)).rejects.toBeInstanceOf(FuelStorageError);
  expect(purchaseFuel("airline-fuel-2", FUEL_STORAGE_CAPACITY_TONNES + 1)).rejects.toBeInstanceOf(FuelStorageError);
});

test("consumeFuelForFlights draws from storage first and spot-buys the shortfall", async () => {
  resetStores();
  await purchaseFuel("airline-fuel-3", 10);

  const consumptions = await consumeFuelForFlights("airline-fuel-3", [
    { flightId: "flight-a", tonnes: 6 },
    { flightId: "flight-b", tonnes: 6 },
  ]);

  expect(consumptions.get("flight-a")).toMatchObject({ from_storage_tonnes: 6, spot_tonnes: 0 });
  expect(consumptions.get("flight-b")).toMatchObject({ from_storage_tonnes: 4, spot_tonnes: 2 });

  const snapshot = await getFuelStorageSnapshot("airline-fuel-3");
  expect(snapshot.stored_tonnes).toBe(0);
  expect(snapshot.history[0]?.reason).toBe("consumption");
  expect(snapshot.history[0]?.change_tonnes).toBe(-10);
});

test("consumeFuelForFlights is idempotent per flight", async () => {
  resetStores();
  await purchaseFuel("airline-fuel-4", 10);

  const first = await consumeFuelForFlights("airline-fuel-4", [{ flightId: "flight-x", tonnes: 4 }]);
  const second = await consumeFuelForFlights("airline-fuel-4", [{ flightId: "flight-x", tonnes: 4 }]);

  expect(second.get("flight-x")).toEqual(first.get("flight-x"));
  expect((await getFuelStorageSnapshot("airline-fuel-4")).stored_tonnes).toBe(6);
});

function resetStores(): void {
  writeDocument("fuel-storage", {});
  writeDocument("ledger", []);
}
