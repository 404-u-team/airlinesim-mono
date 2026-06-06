<script setup lang="ts">
import type { NetworkMessageKey } from "../i18n";
import type { RouteOpportunity, StoredRoute } from "../types";

import RouteListPanel from "./RouteListPanel.vue";
import RouteOpportunityGrid from "./RouteOpportunityGrid.vue";

defineProps<{
  formatMoney: (value: number | undefined) => string;
  formatNumber: (value: number | undefined) => string;
  isLoading: boolean;
  opportunities: RouteOpportunity[];
  recommendationLabel: (value: RouteOpportunity["recommendation"]) => string;
  recommendationVariant: (value: RouteOpportunity["recommendation"]) => "danger-soft" | "success-soft" | "warning-soft";
  routes: StoredRoute[];
  selectedDestinationId: string;
  statusLabel: (status: string) => string;
  t: (key: NetworkMessageKey) => string;
}>();

const emit = defineEmits<{
  "navigate-to-schedule": [route: StoredRoute];
  "select-opportunity": [opportunity: RouteOpportunity];
}>();
</script>

<template>
  <div class="route-planner-lists">
    <section class="flex min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-surface">
      <div class="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <h2 class="text-subtitle">
          {{ t("panel.results") }}
        </h2>
        <span class="text-caption text-text-muted">
          {{ formatNumber(opportunities.length) }}
        </span>
      </div>
      <RouteOpportunityGrid
        class="min-h-0 flex-1"
        :format-money="formatMoney"
        :format-number="formatNumber"
        :is-loading="isLoading"
        :opportunities="opportunities"
        :recommendation-label="recommendationLabel"
        :recommendation-variant="recommendationVariant"
        :selected-destination-id="selectedDestinationId"
        :t="t"
        @select-opportunity="emit('select-opportunity', $event)"
      />
    </section>

    <section class="flex min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-surface">
      <div class="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <h2 class="text-subtitle">
          {{ t("panel.saved") }}
        </h2>
        <span class="text-caption text-text-muted">
          {{ formatNumber(routes.length) }}
        </span>
      </div>
      <RouteListPanel
        class="min-h-0 flex-1"
        :format-number="formatNumber"
        :routes="routes"
        :status-label="statusLabel"
        :t="t"
        @navigate-to-schedule="emit('navigate-to-schedule', $event)"
      />
    </section>
  </div>
</template>

<style scoped>
.route-planner-lists {
  display: grid;
  gap: 0.75rem;
  min-height: 26rem;
}

@media (min-width: 1280px) {
  .route-planner-lists {
    grid-template-columns: minmax(0, 0.72fr) minmax(34rem, 0.28fr);
    height: 18rem;
    min-height: 0;
  }
}
</style>
