import type { BffConfig } from "../../config";
import type { NotificationRisk, StoredNotification } from "./types";

import { buildBaseFacilitiesOverview } from "../facilities/overview";
import { loadFacilitiesSnapshot } from "../facilities/snapshot";
import { buildFinanceRisks, signedAmount } from "../finance/calculator";
import { listLedgerForAirline } from "../finance/storage";
import { reconcileNotificationRisks } from "./notifications";

export async function reconcileNotificationsAfterMutation(request: Request, config: BffConfig): Promise<void> {
  try {
    await reconcileNotificationsForRequest(request, config);
  } catch (error) {
    console.warn("Notification reconciliation after mutation failed:", error);
  }
}

export async function reconcileNotificationsForDashboard(input: {
  aircrafts: Array<{ current_maintenance_points?: number; id?: string; max_maintenance_points_cached?: number }>;
  airlineId: string;
  balance: number;
  bankrupt: boolean;
  routes: Array<{ status?: string }>;
}): Promise<StoredNotification[]> {
  return reconcileNotificationRisks(input.airlineId, [
    ...financeRisks(input.balance, input.bankrupt, input.airlineId),
    ...maintenanceRisks(input.aircrafts, input.airlineId),
    ...routeRisks(input.routes, input.airlineId),
  ]);
}

export async function reconcileNotificationsForRequest(request: Request, config: BffConfig): Promise<StoredNotification[]> {
  const snapshot = await loadFacilitiesSnapshot(request, config);
  const airlineId = snapshot.airline.id ?? "";
  const facilities = buildBaseFacilitiesOverview(snapshot);
  const ledger = await listLedgerForAirline(airlineId);
  const routeProfits = snapshot.routes.map((route) => ({
    profit: ledger
      .filter((transaction) => transaction.route_id === route.id)
      .reduce((total, transaction) => total + signedAmount(transaction), 0),
    route_id: route.id,
  }));
  const weekStart = Date.now() - 7 * 24 * 60 * 60_000;
  const weeklyProfit = ledger
    .filter((transaction) => new Date(transaction.occurred_at).getTime() >= weekStart)
    .reduce((total, transaction) => total + signedAmount(transaction), 0);
  const risks: NotificationRisk[] = [
    ...buildFinanceRisks(
      snapshot.airline.balance ?? 0,
      weeklyProfit,
      Boolean(snapshot.airline.is_bankrupt),
      routeProfits,
    ).map((item) => risk(airlineId, item.code, item.severity, item.target_path, { value: item.value ?? 0 }, item.target_path)),
    ...maintenanceRisks(snapshot.aircrafts, airlineId),
    ...routeRisks(snapshot.routes, airlineId),
    ...scheduleRisks(snapshot.schedules, airlineId),
    ...facilitiesRisks(facilities, airlineId),
  ];

  return reconcileNotificationRisks(airlineId, risks);
}

function facilitiesDefinition(code: string): null | {
  code: NotificationRisk["code"];
} {
  const mapping: Record<string, NotificationRisk["code"]> = {
    AIRPORT_NIGHT_OPS_PROHIBITED: "BASE_NIGHT_OPS_CONFLICT",
    AIRPORT_RUNWAY_TOO_SHORT: "BASE_AIRCRAFT_INCOMPATIBLE",
    AIRPORT_SLOT_CAPACITY_EXCEEDED: "BASE_SLOT_CAPACITY_EXCEEDED",
    AIRPORT_SLOT_CAPACITY_LOW: "BASE_SLOT_CAPACITY_LOW",
  };

  return mapping[code] ? { code: mapping[code] } : null;
}

function facilitiesRisks(
  facilities: ReturnType<typeof buildBaseFacilitiesOverview>,
  airlineId: string,
): NotificationRisk[] {
  return facilities.constraints.flatMap((item) => {
    const definition = facilitiesDefinition(item.code);

    return definition
      ? [{
        airline_id: airlineId,
        code: definition.code,
        dedupe_key: `${definition.code}:${item.affected.airport_id ?? "base"}`,
        parameters: item.parameters,
        related: {},
        severity: item.severity,
        target_path: item.target_path,
      }]
      : [];
  });
}

function financeRisks(balance: number, bankrupt: boolean, airlineId: string): NotificationRisk[] {
  return [
    ...(balance < 5_000_000 ? [risk(airlineId, "LOW_BALANCE", "danger", "/finances/overview", { balance })] : []),
    ...(bankrupt ? [risk(airlineId, "BANKRUPTCY_FLAG", "danger", "/finances/overview", {})] : []),
  ];
}

function maintenanceRisks(
  aircrafts: Array<{ current_maintenance_points?: number; id?: string; max_maintenance_points_cached?: number }>,
  airlineId: string,
): NotificationRisk[] {
  const low = aircrafts.filter((aircraft) => {
    const max = aircraft.max_maintenance_points_cached ?? 0;
    return max > 0 && (aircraft.current_maintenance_points ?? max) / max < 0.35;
  });

  return low.length > 0
    ? [risk(airlineId, "LOW_MAINTENANCE", "warning", "/fleet/maintenance", { aircraft_count: low.length })]
    : [];
}

function risk(
  airlineId: string,
  code: NotificationRisk["code"],
  severity: NotificationRisk["severity"],
  targetPath: string,
  parameters: NotificationRisk["parameters"],
  suffix = "",
): NotificationRisk {
  return {
    airline_id: airlineId,
    code,
    dedupe_key: suffix ? `${code}:${suffix}` : code,
    parameters,
    related: {},
    severity,
    target_path: targetPath,
  };
}

function routeRisks(routes: Array<{ status?: string }>, airlineId: string): NotificationRisk[] {
  const count = routes.filter((route) => route.status === "awaiting_schedule").length;

  return count > 0
    ? [risk(airlineId, "ROUTES_AWAITING_SCHEDULE", "info", "/operations/schedule", { route_count: count })]
    : [];
}

function scheduleRisks(
  schedules: Array<{ checks_snapshot: Array<{ code: string }>; id: string; route_id: string; status: string }>,
  airlineId: string,
): NotificationRisk[] {
  return schedules
    .filter((schedule) => schedule.status === "draft" && schedule.checks_snapshot.length > 0)
    .map((schedule) => ({
      airline_id: airlineId,
      code: "SCHEDULE_BLOCKED",
      dedupe_key: `SCHEDULE_BLOCKED:${schedule.id}`,
      parameters: {
        blocker_count: schedule.checks_snapshot.length,
        first_blocker_code: schedule.checks_snapshot[0]?.code ?? "UNKNOWN",
      },
      related: { route_id: schedule.route_id, schedule_id: schedule.id },
      severity: "danger",
      target_path: `/operations/schedule?route_id=${encodeURIComponent(schedule.route_id)}`,
    }));
}
