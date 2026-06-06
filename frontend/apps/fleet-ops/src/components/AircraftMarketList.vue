<script setup lang="ts">
import { AirBadge } from "@airlinesim/air-ui";

import type { FleetMarketAircraftType, FleetReason } from "../types";

defineProps<{
  formatMoney: (value: number | undefined) => string;
  formatNumber: (value: number | undefined) => string;
  reasonLabel: (reason: FleetReason) => string;
  selectedTypeId: string;
  statusLabel: (status: FleetMarketAircraftType["compatibility"]["status"]) => string;
  statusVariant: (
    status: FleetMarketAircraftType["compatibility"]["status"],
  ) => "danger-soft" | "primary-soft" | "success-soft" | "warning-soft";
  t: (key: string) => string;
  types: FleetMarketAircraftType[];
}>();

const emit = defineEmits<{
  "select-type": [type: FleetMarketAircraftType];
}>();
</script>

<template>
  <div class="mt-4 overflow-hidden rounded-lg border border-border bg-surface">
    <button
      v-for="type in types"
      :key="type.id"
      class="flex w-full min-w-0 items-center gap-3 border-b border-border px-3 py-2.5 text-left transition last:border-b-0 hover:bg-background"
      :class="selectedTypeId === type.id ? 'bg-background' : ''"
      type="button"
      @click="emit('select-type', type)"
    >
      <span class="grid size-10 shrink-0 place-items-center overflow-hidden rounded-md border border-border bg-background text-caption text-text-muted">
        <img
          v-if="type.image_url"
          :alt="type.model_name || 'Aircraft type'"
          class="size-full object-cover"
          loading="lazy"
          :src="type.image_url"
        />
        <template v-else>{{ type.icao_code || "----" }}</template>
      </span>

      <span class="min-w-0 flex-1">
        <span class="flex min-w-0 items-center gap-2">
          <span class="truncate text-subtitle">{{ type.model_name || "Aircraft type" }}</span>
          <span class="shrink-0 text-caption text-text-muted">{{ type.icao_code || "----" }}</span>
        </span>
        <span class="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-caption text-text-muted">
          <span>{{ formatNumber(type.max_planned_seat_capacity) }} {{ t("metric.seats") }}</span>
          <span>{{ formatNumber(type.max_range_km) }} {{ t("unit.km") }}</span>
          <span>{{ formatNumber(type.min_runway_length_m) }} {{ t("unit.m") }}</span>
        </span>
      </span>

      <span class="flex shrink-0 flex-col items-end gap-1">
        <span class="text-subtitle">{{ formatMoney(type.price_per_unit) }}</span>
        <AirBadge
          :label="statusLabel(type.compatibility.status)"
          size="sm"
          :variant="statusVariant(type.compatibility.status)"
        />
      </span>
    </button>

    <p
      v-if="types.length === 0"
      class="p-5 text-text-muted"
    >
      {{ t("market.empty") }}
    </p>
  </div>
</template>
