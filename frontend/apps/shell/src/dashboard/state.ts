import { computed, ref } from "vue";

import type { DashboardSummary, ShellStatusSummary } from "./types";

const dashboardSummary = ref<DashboardSummary | null>(null);

export const dashboardState = {
  statusSummary: computed<null | ShellStatusSummary>(() => {
    const summary = dashboardSummary.value;

    if (!summary) {
      return null;
    }

    return {
      aircraft: summary.fleet.total_aircraft,
      alerts: summary.alerts.length,
      balance: summary.airline.balance,
    };
  }),
  summary: computed(() => dashboardSummary.value),
};

export function setDashboardSummary(summary: DashboardSummary | null): void {
  dashboardSummary.value = summary;
}
