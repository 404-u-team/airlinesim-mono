<script setup lang="ts">
import { AirBadge } from "@airlinesim/air-ui";

import type { NetworkMessageKey } from "../i18n";
import type { RouteOpportunity } from "../types";

defineProps<{
  formatMoney: (value: number | undefined) => string;
  formatNumber: (value: number | undefined) => string;
  isLoading: boolean;
  opportunities: RouteOpportunity[];
  recommendationLabel: (value: RouteOpportunity["recommendation"]) => string;
  recommendationVariant: (value: RouteOpportunity["recommendation"]) => "danger-soft" | "success-soft" | "warning-soft";
  selectedDestinationId: string;
  t: (key: NetworkMessageKey) => string;
}>();

const emit = defineEmits<{
  "select-opportunity": [opportunity: RouteOpportunity];
}>();
</script>

<template>
  <div class="mt-4 grid gap-3 lg:grid-cols-2">
    <button
      v-for="opportunity in opportunities"
      :key="opportunity.destination_airport.id"
      class="rounded-lg border bg-surface p-4 text-left transition hover:border-warning"
      :class="selectedDestinationId === opportunity.destination_airport.id ? 'border-warning' : 'border-border'"
      type="button"
      @click="emit('select-opportunity', opportunity)"
    >
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <h2 class="truncate text-subtitle">
            {{ opportunity.destination_airport.label }}
          </h2>
          <p class="mt-1 text-caption text-text-muted">
            {{ formatNumber(opportunity.demand.distance_km) }} km
          </p>
        </div>
        <AirBadge
          :label="recommendationLabel(opportunity.recommendation)"
          :variant="recommendationVariant(opportunity.recommendation)"
        />
      </div>
      <div class="mt-4 grid grid-cols-2 gap-3 text-caption text-text-muted">
        <span>{{ t("metric.weekDemand") }}: {{ formatNumber(opportunity.demand.origin_daily_passengers) }}</span>
        <span>{{ t("metric.profit") }}: {{ formatMoney(opportunity.economics.estimated_profit_per_flight) }}</span>
        <span>{{ t("metric.aircraft") }}: {{ formatNumber(opportunity.compatible_aircraft.filter((option) => option.isCompatible).length) }}</span>
        <span>{{ t("metric.load") }}: {{ formatNumber(opportunity.economics.expected_load_factor * 100) }}%</span>
      </div>
    </button>
  </div>

  <div
    v-if="!isLoading && opportunities.length === 0"
    class="mt-4 rounded-lg border border-border bg-surface p-5 text-text-muted"
  >
    {{ t("empty.noOpportunities") }}
  </div>
</template>
