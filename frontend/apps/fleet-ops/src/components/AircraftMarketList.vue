<script setup lang="ts">
import { AirBadge, AirButton } from "@airlinesim/air-ui";

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
  <div class="mt-4 grid gap-3 lg:grid-cols-2">
    <article
      v-for="type in types"
      :key="type.id"
      class="min-w-0 rounded-lg border bg-surface p-4 transition"
      :class="selectedTypeId === type.id ? 'border-primary' : 'border-border'"
    >
      <div class="flex min-w-0 items-start justify-between gap-3">
        <button
          class="min-w-0 text-left"
          type="button"
          @click="emit('select-type', type)"
        >
          <h2 class="truncate text-subtitle">
            {{ type.model_name || "Aircraft type" }}
          </h2>
          <p class="mt-1 text-caption text-text-muted">
            {{ type.icao_code || "----" }} / {{ type.iata_code || "---" }}
          </p>
        </button>
        <AirBadge
          :label="statusLabel(type.compatibility.status)"
          :variant="statusVariant(type.compatibility.status)"
        />
      </div>

      <div class="mt-4 grid grid-cols-2 gap-3 text-caption text-text-muted sm:grid-cols-4">
        <span>{{ formatMoney(type.price_per_unit) }}</span>
        <span>{{ formatNumber(type.max_planned_seat_capacity) }} {{ t("metric.seats") }}</span>
        <span>{{ formatNumber(type.max_range_km) }} {{ t("unit.km") }}</span>
        <span>{{ formatNumber(type.min_runway_length_m) }} {{ t("unit.m") }}</span>
        <span>{{ formatNumber(type.cruising_speed_kph) }} {{ t("unit.kph") }}</span>
        <span>{{ formatNumber(type.fuel_consumption_per_hour) }} {{ t("unit.kgHour") }}</span>
        <span>{{ formatMoney(type.preview.remainingBalance) }} {{ t("metric.remaining") }}</span>
        <span>{{ formatMoney(type.preview.estimatedDailyMaintenanceReserve) }}/{{ t("unit.day") }}</span>
      </div>

      <div
        v-if="type.compatibility.warnings.length"
        class="mt-4 flex flex-wrap gap-2"
      >
        <AirBadge
          v-for="warning in type.compatibility.warnings"
          :key="warning.code"
          :label="reasonLabel(warning)"
          size="sm"
          :variant="type.compatibility.status === 'blocked' ? 'danger-soft' : 'warning-soft'"
        />
      </div>

      <AirButton
        class="mt-4 w-full"
        :label="type.compatibility.canPurchase ? t('action.reviewPurchase') : t('market.blocked')"
        size="sm"
        :variant="type.compatibility.canPurchase ? 'primary' : 'danger-soft'"
        @click="emit('select-type', type)"
      />
    </article>

    <div
      v-if="types.length === 0"
      class="rounded-lg border border-border bg-surface p-5 text-text-muted lg:col-span-2"
    >
      {{ t("market.empty") }}
    </div>
  </div>
</template>
