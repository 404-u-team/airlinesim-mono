import { expect, test } from "bun:test";

import { markAllNotificationsRead, patchNotificationRead, reconcileNotificationRisks } from "../src/modules/events/notifications";
import { recordGameEvent } from "../src/modules/events/producer";
import { listEventsForAirline } from "../src/modules/events/storage";

test("event producer deduplicates immutable events and isolates airlines", async () => {
  const airlineId = `airline-${crypto.randomUUID()}`;
  const otherAirlineId = `airline-${crypto.randomUUID()}`;
  const input = {
    airline_id: airlineId,
    category: "fleet" as const,
    code: "AIRCRAFT_PURCHASED" as const,
    dedupe_key: "purchase:aircraft-1",
    occurred_at: "2026-06-04T10:00:00.000Z",
    parameters: { tail_number: "HL-001" },
    related: { aircraft_id: "aircraft-1" },
    severity: "success" as const,
    source_id: "aircraft-1",
    source_type: "aircraft" as const,
    target_path: "/fleet/aircraft",
  };

  const first = await recordGameEvent(input);
  const duplicate = await recordGameEvent({ ...input, parameters: { tail_number: "CHANGED" } });
  await recordGameEvent({ ...input, airline_id: otherAirlineId });

  expect(duplicate.id).toBe(first.id);
  expect((await listEventsForAirline(airlineId))).toHaveLength(1);
  expect((await listEventsForAirline(airlineId))[0]?.parameters.tail_number).toBe("HL-001");
});

test("notification reconcile preserves read state and resolves disappeared risks", async () => {
  const airlineId = `airline-${crypto.randomUUID()}`;
  const risks = [{
    airline_id: airlineId,
    code: "LOW_BALANCE" as const,
    dedupe_key: "LOW_BALANCE",
    parameters: { balance: 10 },
    related: {},
    severity: "danger" as const,
    target_path: "/finances/overview",
  }];

  const created = await reconcileNotificationRisks(airlineId, risks);
  const notificationId = created[0]?.id ?? "";
  await patchNotificationRead(airlineId, notificationId, true);
  const updated = await reconcileNotificationRisks(airlineId, [{ ...risks[0], parameters: { balance: 5 } }]);
  const resolved = await reconcileNotificationRisks(airlineId, []);
  const resolutionEvents = await listEventsForAirline(airlineId);

  expect(updated[0]).toMatchObject({ id: notificationId, is_read: true, parameters: { balance: 5 }, state: "active" });
  expect(resolved[0]).toMatchObject({ id: notificationId, is_read: true, state: "resolved" });
  expect(resolutionEvents.some((event) => event.code === "WARNING_RESOLVED")).toBe(true);
});

test("read all only marks active notifications", async () => {
  const airlineId = `airline-${crypto.randomUUID()}`;
  await reconcileNotificationRisks(airlineId, [{
    airline_id: airlineId,
    code: "ROUTES_AWAITING_SCHEDULE",
    dedupe_key: "ROUTES_AWAITING_SCHEDULE",
    parameters: { route_count: 1 },
    related: {},
    severity: "info",
    target_path: "/operations/schedule",
  }]);

  const notifications = await markAllNotificationsRead(airlineId);

  expect(notifications[0]).toMatchObject({ is_read: true, state: "active" });
});
