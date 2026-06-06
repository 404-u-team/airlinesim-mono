<script setup lang="ts">
import { AirBadge, AirButton } from "@airlinesim/air-ui";

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

function airportCode(airport: RouteOpportunity["destination_airport"]): string {
  return airport.iata_code || airport.icao_code || airport.id || "-";
}

function reasonLabel(reason: { code: string; message: string }): string {
  // BFF sends reason.message === code; translate by code, fall back to the raw code.
  return props.t(`reason.${reason.code}` as NetworkMessageKey) || reason.message;
}
</script>

<template>
  <aside class="h-full overflow-y-auto bg-surface p-3">
    <p
      v-if="!currentPreview"
      class="text-body text-text-muted"
    >
      {{ t("preview.empty") }}
    </p>
    <template v-else>
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0 flex-1">
          <div class="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-start gap-2">
            <div class="min-w-0">
              <p class="text-h3 leading-tight">
                {{ airportCode(currentPreview.origin_airport) }}
              </p>
              <p class="mt-1 truncate text-caption text-text-muted">
                {{ currentPreview.origin_airport.label }}
              </p>
            </div>
            <span
              aria-hidden="true"
              class="route-preview-direction mt-1"
            />
            <div class="min-w-0 text-right">
              <p class="text-h3 leading-tight">
                {{ airportCode(currentPreview.destination_airport) }}
              </p>
              <p class="mt-1 truncate text-caption text-text-muted">
                {{ currentPreview.destination_airport.label }}
              </p>
            </div>
          </div>
        </div>
        <AirBadge
          class="shrink-0"
          :label="recommendationLabel(currentPreview.recommendation)"
          :variant="recommendationVariant(currentPreview.recommendation)"
        />
      </div>
      <div class="mt-3 grid gap-2">
        <div class="flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2">
          <span class="text-caption text-text-muted">{{ t("metric.distance") }}</span>
          <span class="text-subtitle">{{ formatNumber(currentPreview.demand.distance_km) }} {{ t("metric.km") }}</span>
        </div>
        <div class="flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2">
          <span class="text-caption text-text-muted">{{ t("metric.weekDemand") }}</span>
          <span class="text-subtitle">{{ formatNumber(currentPreview.demand.origin_daily_passengers) }} {{ t("metric.paxPerDay") }}</span>
        </div>
        <div class="flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2">
          <span class="text-caption text-text-muted">{{ t("metric.profit") }}</span>
          <span
            class="text-subtitle"
            :class="currentPreview.economics.estimated_profit_per_flight > 0 ? 'text-success' : 'text-error'"
          >
            {{ formatMoney(currentPreview.economics.estimated_profit_per_flight) }}
          </span>
        </div>
      </div>
      <div
        v-if="currentPreview.constraints.length"
        class="mt-3 rounded-lg border border-error bg-error-bg p-3 text-error"
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

      <div class="mt-3 rounded-lg border border-border bg-background p-3">
        <p class="text-caption text-text-muted">
          {{ t("preview.fleet") }}
        </p>
        <p
          v-if="!currentPreview.compatible_aircraft.length"
          class="mt-2 text-caption text-text-muted"
        >
          {{ t("preview.fleet.empty") }}
        </p>
        <ul
          v-else
          class="mt-2 grid gap-2"
        >
          <li
            v-for="option in currentPreview.compatible_aircraft"
            :key="option.aircraft.id ?? option.aircraft.tail_number"
            class="flex items-start justify-between gap-2"
          >
            <div class="min-w-0">
              <p class="truncate text-body">
                {{ option.aircraft.tail_number ?? option.aircraft.id }}
                <span class="text-text-muted">· {{ option.type?.model_name ?? option.aircraft.type_id }}</span>
              </p>
              <p
                v-if="!option.isCompatible && option.blockers.length"
                class="mt-0.5 text-caption text-error"
              >
                {{ reasonLabel(option.blockers[0]) }}
              </p>
            </div>
            <AirBadge
              class="shrink-0"
              :label="option.isCompatible ? t('preview.fleet.compatible') : t('preview.fleet.blocked')"
              :variant="option.isCompatible ? 'success-soft' : 'danger-soft'"
            />
          </li>
        </ul>
      </div>
      <AirButton
        class="mt-3 w-full"
        :disabled="isCreating || isPreviewLoading || currentPreview.recommendation === 'blocked'"
        :label="isCreating ? '...' : t('action.create')"
        variant="warning"
        @click="emit('create-selected-route')"
      />
    </template>
  </aside>
</template>

<style scoped>
.route-preview-direction {
  align-items: center;
  display: inline-flex;
  height: 1.25rem;
  justify-content: center;
  position: relative;
  width: 1.75rem;
}

.route-preview-direction::before {
  background: currentcolor;
  content: "";
  height: 0.125rem;
  width: 1.25rem;
}

.route-preview-direction::after {
  border-right: 0.125rem solid currentcolor;
  border-top: 0.125rem solid currentcolor;
  content: "";
  height: 0.45rem;
  margin-left: -0.45rem;
  transform: rotate(45deg);
  width: 0.45rem;
}
</style>
