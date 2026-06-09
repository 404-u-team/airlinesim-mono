<script setup lang="ts">
import { AirBadge, AirProgressBar } from "@airlinesim/air-ui";

import type { FleetOwnedAircraftCard } from "../types";

defineProps<{
  aircraftItem: FleetOwnedAircraftCard;
  formatNumber: (value: number | undefined) => string;
  formatPercent: (value: number | undefined) => string;
  progressBarTone: "danger" | "neutral" | "primary" | "success" | "warning";
  statusLabel: string;
  statusVariant: "primary-soft" | "success-soft" | "warning-soft";
  t: (key: string) => string;
}>();

const emit = defineEmits<{
  click: [];
}>();
</script>

<template>
  <button
    class="group flex flex-col overflow-hidden rounded-xl border border-border bg-surface text-left transition-all duration-300 hover:border-primary/50 hover:bg-surface-subtle/80 hover:shadow-lg hover:-translate-y-0.5"
    type="button"
    @click="emit('click')"
  >
    <!-- Card Image Area -->
    <div class="relative h-44 w-full overflow-hidden border-b border-border bg-background flex items-center justify-center">
      <img
        v-if="aircraftItem.type?.image_url"
        :alt="aircraftItem.modelName"
        class="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        loading="lazy"
        :src="aircraftItem.type.image_url"
      />
      <div
        v-else
        class="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-background to-surface-subtle p-4 text-center"
      >
        <span class="text-h1 font-bold tracking-wider text-text-muted/40">
          {{ aircraftItem.type?.icao_code ?? "----" }}
        </span>
        <span class="mt-1 text-caption text-text-muted/60">
          {{ aircraftItem.modelName }}
        </span>
      </div>

      <!-- Status badge absolute overlay -->
      <div class="absolute top-3 right-3">
        <AirBadge
          :label="statusLabel"
          size="sm"
          :variant="statusVariant"
        />
      </div>
    </div>

    <!-- Card Content Area -->
    <div class="flex flex-col p-4 gap-3 flex-1">
      <div>
        <h3 class="text-subtitle font-bold text-text-primary group-hover:text-primary transition-colors">
          {{ aircraftItem.tail_number ?? aircraftItem.id }}
        </h3>
        <p class="text-caption text-text-muted mt-0.5">
          {{ aircraftItem.modelName }}
        </p>
      </div>

      <!-- Base info -->
      <div class="flex items-center justify-between rounded-lg bg-background p-2 text-caption">
        <span class="text-text-muted">{{ t("market.base") }}</span>
        <span class="font-semibold text-text-primary">{{ aircraftItem.baseAirportName }}</span>
      </div>

      <!-- Progress Bar for Maintenance -->
      <div class="space-y-1">
        <div class="flex justify-between text-caption text-text-muted">
          <span>{{ t("metric.maintenance") }}</span>
          <span class="font-medium text-text-primary">
            {{ formatPercent(aircraftItem.maintenanceRatio) }}
          </span>
        </div>
        <AirProgressBar
          :percent="Math.round(aircraftItem.maintenanceRatio * 100)"
          :tone="progressBarTone"
        />
      </div>

      <!-- Metrics stats grid -->
      <div class="grid grid-cols-2 gap-2 pt-2 border-t border-border/60">
        <div>
          <span class="block text-caption text-text-muted">{{ t("metric.hours") }}</span>
          <span class="text-body font-semibold text-text-primary">
            {{ formatNumber(aircraftItem.total_flight_hours) }}
          </span>
        </div>
        <div>
          <span class="block text-caption text-text-muted">{{ t("metric.cycles") }}</span>
          <span class="text-body font-semibold text-text-primary">
            {{ formatNumber(aircraftItem.total_cycles) }}
          </span>
        </div>
      </div>
    </div>
  </button>
</template>
