<script setup lang="ts">
import { AirMetricCard } from "@airlinesim/air-ui";
import { type Locale, translate } from "@airlinesim/i18n";
import { computed } from "vue";

import type { DashboardSummary } from "./types";

import { type ShellMessageKey, shellMessages } from "../i18n/messages";

const props = defineProps<{
  appLocale: Locale;
  summary: DashboardSummary;
}>();

const t = computed(() => (key: ShellMessageKey): string =>
  translate(shellMessages, props.appLocale, key),
);

function formatMoney(value: number): string {
  return new Intl.NumberFormat(props.appLocale, {
    currency: "USD",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(value);
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat(props.appLocale, { maximumFractionDigits: 0 }).format(value);
}
</script>

<template>
  <div class="grid grid-cols-2 gap-2">
    <AirMetricCard
      class="col-span-2"
      :label="t('dashboard.metric.balance')"
      :tone="summary.airline.balance < 5_000_000 ? 'warning' : 'success'"
      :value="formatMoney(summary.airline.balance)"
    />
    <AirMetricCard
      :label="t('dashboard.metric.aircraft')"
      :tone="summary.fleet.total_aircraft === 0 ? 'warning' : 'neutral'"
      :value="formatNumber(summary.fleet.total_aircraft)"
    />
    <AirMetricCard
      :label="t('dashboard.metric.routes')"
      :hint="summary.routes.capabilities === 'not_configured' ? t('dashboard.capability.routesPending') : undefined"
      :value="formatNumber(summary.routes.active_routes)"
    />
    <AirMetricCard
      :label="t('dashboard.metric.flights')"
      :hint="summary.flights.capabilities === 'not_configured' ? t('dashboard.capability.flightsPending') : undefined"
      :value="formatNumber(summary.flights.live_flights + summary.flights.upcoming_flights)"
    />
    <AirMetricCard
      :label="t('dashboard.metric.alerts')"
      :tone="summary.alerts.length > 0 ? 'warning' : 'success'"
      :value="formatNumber(summary.alerts.length)"
    />
  </div>
</template>
