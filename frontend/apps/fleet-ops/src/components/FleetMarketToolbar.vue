<script setup lang="ts">
import { AirBadge, AirButton, AirMetricCard, AirSelect, AirTextField } from "@airlinesim/air-ui";

import type { FleetMarketResponse } from "../types";

type FilterKey = "maxPrice" | "minCapacity" | "minRange" | "q" | "sort";

const props = defineProps<{
  error: string;
  filters: {
    maxPrice: string;
    minCapacity: string;
    minRange: string;
    q: string;
    sort: string;
  };
  formatMoney: (value: number | undefined) => string;
  formatNumber: (value: number | undefined) => string;
  isLoading: boolean;
  market: FleetMarketResponse | null;
  message: string;
  sortOptions: { label: string; value: string }[];
  t: (key: string) => string;
}>();

const emit = defineEmits<{
  refresh: [];
  "update-filter": [key: FilterKey, value: string];
}>();

function updateFilter(key: FilterKey, value: string): void {
  emit("update-filter", key, value);
}
</script>

<template>
  <div class="flex flex-col gap-5 border-b border-border pb-5 lg:flex-row lg:items-end lg:justify-between">
    <div class="min-w-0">
      <AirBadge
        :label="t('market.badge')"
        variant="primary-soft"
      />
      <h1 class="mt-4 text-h2">
        {{ t("market.title") }}
      </h1>
      <p class="mt-2 max-w-3xl text-body text-text-muted">
        {{ t("market.subtitle") }}
      </p>
    </div>
    <AirButton
      :disabled="isLoading"
      :label="t('action.refresh')"
      size="sm"
      variant="primary-soft"
      @click="emit('refresh')"
    />
  </div>

  <div
    v-if="error || message"
    class="mt-4 rounded-lg border p-3 text-body"
    :class="error ? 'border-error bg-error-bg text-error' : 'border-success bg-success-bg text-success'"
  >
    {{ error || message }}
  </div>

  <div
    v-if="market"
    class="mt-5 grid gap-3 md:grid-cols-3"
  >
    <AirMetricCard
      :label="t('metric.balance')"
      tone="success"
      :value="formatMoney(market.airline.balance)"
    />
    <AirMetricCard
      :label="t('market.base')"
      :value="market.baseAirport?.label ?? '-'"
    />
    <AirMetricCard
      :label="t('aircraft.owned')"
      :value="formatNumber(market.ownedAircraft.length)"
    />
  </div>

  <div
    v-if="market"
    class="mt-6 grid gap-3 rounded-lg border border-border bg-surface p-4 md:grid-cols-2 xl:grid-cols-5"
  >
    <AirTextField
      :label="t('filter.search')"
      :model-value="props.filters.q"
      :placeholder="t('filter.search.placeholder')"
      type="search"
      @update:model-value="updateFilter('q', $event)"
    />
    <AirTextField
      :label="t('filter.minRange')"
      :model-value="props.filters.minRange"
      @update:model-value="updateFilter('minRange', $event)"
    />
    <AirTextField
      :label="t('filter.minCapacity')"
      :model-value="props.filters.minCapacity"
      @update:model-value="updateFilter('minCapacity', $event)"
    />
    <AirTextField
      :label="t('filter.maxPrice')"
      :model-value="props.filters.maxPrice"
      @update:model-value="updateFilter('maxPrice', $event)"
    />
    <div class="flex min-w-0 flex-col gap-1.5">
      <span class="text-caption text-text-muted">{{ t("filter.sort") }}</span>
      <AirSelect
        class="w-full"
        :label="t('filter.sort')"
        :model-value="props.filters.sort"
        :options="sortOptions"
        @update:model-value="updateFilter('sort', $event)"
      />
    </div>
  </div>
</template>
