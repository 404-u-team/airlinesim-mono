import { expect, test } from "bun:test";

import { dashboardState, setDashboardSummary } from "../src/dashboard/state";
import type { DashboardSummary } from "../src/dashboard/types";

test("dashboard status summary exposes topbar metrics from dashboard read model", () => {
  setDashboardSummary({
    airline: {
      balance: 12_500_000,
      credit_rating: 80,
      id: "airline-1",
      is_bankrupt: false,
      name: "Seoul Air",
      reputation: 50,
      safety_rating: 90,
    },
    alerts: [
      {
        action_code: "BUY_FIRST_AIRCRAFT",
        code: "NO_AIRCRAFT",
        severity: "warning",
        target_path: "/fleet/overview",
      },
    ],
    base: {
      airport: null,
      status: "missing",
      warnings: ["MISSING_BASE"],
    },
    fleet: {
      average_maintenance_ratio: 0,
      compatible_base_types: 0,
      fleet_value: 0,
      in_flight_aircraft: 0,
      maintenance_aircraft: 0,
      ready_aircraft: 0,
      total_aircraft: 2,
    },
    flights: {
      capabilities: "not_configured",
      completed_today: 0,
      items: [],
      live_flights: 0,
      upcoming_flights: 0,
    },
    navigation_progress: [],
    next_action: {
      code: "PLAN_FIRST_ROUTE",
      target_path: "/airports/routes",
    },
    routes: {
      active_routes: 0,
      awaiting_schedule: 0,
      capabilities: "not_configured",
      draft_routes: 0,
      items: [],
    },
    updated_at: new Date(0).toISOString(),
  } satisfies DashboardSummary);

  expect(dashboardState.statusSummary.value).toEqual({
    aircraft: 2,
    alerts: 1,
    balance: 12_500_000,
  });

  setDashboardSummary(null);
});
