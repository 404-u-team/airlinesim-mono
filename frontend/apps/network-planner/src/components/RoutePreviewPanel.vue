<script setup lang="ts">
import { AirBadge, AirButton, AirMetricCard } from "@airlinesim/air-ui";

import type { NetworkMessageKey } from "../i18n";
import type { RouteOpportunity } from "../types";

const props = defineProps<{
  currentPreview: null | RouteOpportunity;
  formatMoney: (value: number | undefined) => string;
  formatNumber: (value: number | undefined) => string;
  isCreating: boolean;
  isPreviewLoading: boolean;
  recommendationLabel: (value: RouteOpportunity["recommendation"]) => string;
  recommendationVariant: (value: RouteOpportunity["recommendation"]) => "danger-soft" | "success-soft" | "warning-soft";
  t: (key: NetworkMessageKey) => string;
}>();

const emit = defineEmits<{
  "create-selected-route": [];
}>();

function reasonLabel(reason: { code: string; message: string }): string {
  // BFF sends reason.message === code; translate by code, fall back to the raw code.
  return props.t(`reason.${reason.code}` as NetworkMessageKey) || reason.message;
}
</script>

<template>
  <aside class="rounded-lg border border-border bg-surface p-4">
    <h2 class="text-subtitle">
      {{ t("preview.title") }}
    </h2>
    <p
      v-if="!currentPreview"
      class="mt-2 text-body text-text-muted"
    >
      {{ t("preview.empty") }}
    </p>
    <template v-else>
      <div class="mt-3 flex items-center justify-between gap-3">
        <p class="min-w-0 truncate text-subtitle">
          {{ currentPreview.origin_airport.label }} -> {{ currentPreview.destination_airport.label }}
        </p>
        <AirBadge
          :label="recommendationLabel(currentPreview.recommendation)"
          :variant="recommendationVariant(currentPreview.recommendation)"
        />
      </div>
      <div class="mt-4 grid gap-3">
        <AirMetricCard
          :label="t('metric.distance')"
          :value="`${formatNumber(currentPreview.demand.distance_km)} km`"
        />
        <AirMetricCard
          :label="t('metric.weekDemand')"
          :value="formatNumber(currentPreview.demand.origin_daily_passengers)"
        />
        <AirMetricCard
          :label="t('metric.profit')"
          :tone="currentPreview.economics.estimated_profit_per_flight > 0 ? 'success' : 'warning'"
          :value="formatMoney(currentPreview.economics.estimated_profit_per_flight)"
        />
      </div>
      <div
        v-if="currentPreview.constraints.length"
        class="mt-4 rounded-lg border border-error bg-error-bg p-3 text-error"
      >
        <p class="text-subtitle">
          {{ t("preview.blockers") }}
        </p>
        <ul class="mt-2 list-inside list-disc">
          <li
            v-for="reason in currentPreview.constraints"
            :key="reason.code"
          >
            {{ reasonLabel(reason) }}
          </li>
        </ul>
      </div>
      <AirButton
        class="mt-4 w-full"
        :disabled="isCreating || isPreviewLoading || currentPreview.recommendation === 'blocked'"
        :label="isCreating ? '...' : t('action.create')"
        variant="warning"
        @click="emit('create-selected-route')"
      />
    </template>
  </aside>
</template>
