<script setup lang="ts">
import type { Locale } from "@airlinesim/i18n";

import { AirBadge, AirMetricCard } from "@airlinesim/air-ui";

import type { FleetMessageKey } from "../i18n";
import type { FlightCard } from "../types";

import { formatMoneyValue } from "../formatters";

const props = defineProps<{
  appLocale: Locale;
  flight: FlightCard | null;
  t: (key: FleetMessageKey | string) => string;
}>();

function airportCode(airport: FlightCard["origin_airport"], fallbackId: string): string {
  return airport?.iata_code ?? airport?.label ?? fallbackId;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(props.appLocale, { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function formatMoney(value: number | undefined): string {
  return formatMoneyValue(props.appLocale, value);
}

function progressPercent(flight: FlightCard): number {
  const start = new Date(flight.departure_at).getTime();
  const end = new Date(flight.arrival_at).getTime();

  if (flight.status === "completed") {
    return 100;
  }
  if (flight.status === "scheduled") {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round(((Date.now() - start) / Math.max(end - start, 1)) * 100)));
}

function routeLabel(flight: FlightCard): string {
  return `${airportCode(flight.origin_airport, flight.origin_airport_id)} → ${airportCode(flight.destination_airport, flight.destination_airport_id)}`;
}

function statusLabel(status: FlightCard["status"]): string {
  return props.t(`flight.status.${status}`);
}

function statusVariant(status: FlightCard["status"]): "danger-soft" | "primary-soft" | "success-soft" | "warning-soft" {
  if (status === "completed") {
    return "success-soft";
  }
  if (status === "boarding" || status === "in_flight") {
    return "warning-soft";
  }
  if (status === "cancelled") {
    return "danger-soft";
  }
  return "primary-soft";
}
</script>

<template>
  <section class="rounded-lg border border-border bg-surface p-4">
    <h2 class="text-subtitle">
      {{ props.t("operations.selectedFlight") }}
    </h2>
    <template v-if="props.flight">
      <div class="mt-4 flex items-start justify-between gap-3">
        <div class="min-w-0">
          <p class="truncate text-h3">
            {{ props.flight.flight_number }}
          </p>
          <p class="mt-1 text-body text-text-muted">
            {{ routeLabel(props.flight) }}
          </p>
        </div>
        <AirBadge
          :label="statusLabel(props.flight.status)"
          :variant="statusVariant(props.flight.status)"
        />
      </div>
      <div class="mt-5 h-3 overflow-hidden rounded-full bg-surface-subtle">
        <div
          class="h-full rounded-full bg-primary"
          :style="{ width: `${progressPercent(props.flight)}%` }"
        />
      </div>
      <div class="mt-4 grid gap-3">
        <AirMetricCard
          :label="props.t('operations.departure')"
          :value="formatDate(props.flight.departure_at)"
        />
        <AirMetricCard
          :label="props.t('operations.arrival')"
          :value="formatDate(props.flight.arrival_at)"
        />
        <AirMetricCard
          :label="props.t('operations.weeklyProfit')"
          :tone="props.flight.expected.profit >= 0 ? 'success' : 'warning'"
          :value="formatMoney(props.flight.expected.profit)"
        />
      </div>
    </template>
    <p
      v-else
      class="mt-4 text-caption text-text-muted"
    >
      {{ props.t("operations.selectFlightHint") }}
    </p>
  </section>
</template>
