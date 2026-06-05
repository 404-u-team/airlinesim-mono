import { computed, ref } from "vue";

import type { DashboardSummary, ShellStatusSummary } from "./types";

import { getDashboardSummary } from "./api";

const dashboardSummary = ref<DashboardSummary | null>(null);
const dashboardSummaryError = ref("");
const isDashboardSummaryLoading = ref(false);

export const dashboardState = {
  error: computed(() => dashboardSummaryError.value),
  isLoading: computed(() => isDashboardSummaryLoading.value),
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

export async function refreshDashboardSummary(): Promise<void> {
  isDashboardSummaryLoading.value = true;
  dashboardSummaryError.value = "";

  try {
    dashboardSummary.value = await getDashboardSummary();
  } catch (error) {
    dashboardSummaryError.value = error instanceof Error ? error.message : "Could not load dashboard summary.";
  } finally {
    isDashboardSummaryLoading.value = false;
  }
}

export function setDashboardSummary(summary: DashboardSummary | null): void {
  dashboardSummary.value = summary;
}
