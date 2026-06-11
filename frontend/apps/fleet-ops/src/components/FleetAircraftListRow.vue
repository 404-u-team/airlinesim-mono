<script setup lang="ts">
import { AirAircraftThumb, AirBadge, AirProgressBar } from "@airlinesim/air-ui";

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
    class="flex w-full flex-col gap-4 p-4 text-left transition duration-200 hover:bg-background/80 md:flex-row md:items-center md:justify-between md:gap-6"
    type="button"
    @click="emit('click')"
  >
    <!-- Thumbnail & Identity -->
    <div class="flex min-w-0 flex-1 items-center gap-4">
      <AirAircraftThumb
        :alt="aircraftItem.modelName"
        :fallback="aircraftItem.type?.icao_code"
        :image-url="aircraftItem.type?.image_url"
        size="lg"
      />

      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-2">
          <span class="truncate text-subtitle font-semibold text-text-primary">
            {{ aircraftItem.tail_number ?? aircraftItem.id }}
          </span>
          <AirBadge
            :label="statusLabel"
            size="sm"
            :variant="statusVariant"
          />
        </div>
        <span class="mt-1 block truncate text-caption text-text-muted">
          {{ aircraftItem.modelName }} • <span class="text-text-primary font-medium">{{ aircraftItem.baseAirportName }}</span> ({{ t("market.base") }})
        </span>
      </div>
    </div>

    <!-- Stats (Row on medium screens and up) -->
    <div class="grid grid-cols-3 gap-4 border-t border-border/40 pt-3 md:flex md:items-center md:gap-8 md:border-t-0 md:pt-0">
      <div class="w-28 space-y-1">
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
  </button>
</template>
