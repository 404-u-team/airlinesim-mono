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

function compatibleCount(opportunity: RouteOpportunity): number {
  return opportunity.compatible_aircraft.filter((option) => option.isCompatible).length;
}
</script>

<template>
  <div class="route-opportunity-grid h-full overflow-y-auto bg-surface">
    <button
      v-for="opportunity in opportunities"
      :key="opportunity.destination_airport.id"
      class="flex w-full min-w-0 items-center gap-3 border-b border-border px-3 py-2.5 text-left transition last:border-b-0 hover:bg-background"
      :class="selectedDestinationId === opportunity.destination_airport.id ? 'bg-background' : ''"
      type="button"
      @click="emit('select-opportunity', opportunity)"
    >
      <span class="min-w-0 flex-1">
        <span class="block truncate text-subtitle">{{ opportunity.destination_airport.label }}</span>
        <span class="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-caption text-text-muted">
          <span>{{ formatNumber(opportunity.demand.distance_km) }} {{ t("metric.km") }}</span>
          <span>{{ formatNumber(opportunity.demand.origin_daily_passengers) }} {{ t("metric.paxPerDay") }}</span>
          <span>{{ formatNumber(opportunity.economics.expected_load_factor * 100) }}%</span>
          <span :class="compatibleCount(opportunity) > 0 ? 'text-success' : 'text-error'">
            {{ formatNumber(compatibleCount(opportunity)) }} {{ t("metric.aircraftShort") }}
          </span>
        </span>
      </span>

      <span class="flex shrink-0 flex-col items-end gap-1">
        <span
          class="text-subtitle"
          :class="opportunity.economics.estimated_profit_per_flight > 0 ? 'text-success' : 'text-error'"
        >
          {{ formatMoney(opportunity.economics.estimated_profit_per_flight) }}
        </span>
        <AirBadge
          :label="recommendationLabel(opportunity.recommendation)"
          size="sm"
          :variant="recommendationVariant(opportunity.recommendation)"
        />
      </span>
    </button>

    <p
      v-if="!isLoading && opportunities.length === 0"
      class="p-5 text-text-muted"
    >
      {{ t("empty.noOpportunities") }}
    </p>
  </div>
</template>

<style scoped>
.route-opportunity-grid {
  min-height: 0;
}
</style>
