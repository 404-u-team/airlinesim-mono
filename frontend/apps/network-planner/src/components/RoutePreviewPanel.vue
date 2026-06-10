<script setup lang="ts">
import { AirAircraftThumb, AirBadge, AirButton } from "@airlinesim/air-ui";
import { computed, ref } from "vue";

import type { NetworkMessageKey } from "../i18n";
import type { RouteOpportunity } from "../types";

import DemandExplainerModal from "./DemandExplainerModal.vue";

const props = defineProps<{
  currentPreview: null | RouteOpportunity;
  fareOutbound: string;
  fareReturn: string;
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
  "update:fare-outbound": [value: string];
  "update:fare-return": [value: string];
}>();

// Demand shown at planning time is the average of both directions (origin↔destination),
// a fairer headline than the one-way origin figure.
const averageDailyDemand = computed(() => {
  const demand = props.currentPreview?.demand;
  if (!demand) {
    return 0;
  }

  return Math.round((demand.origin_daily_passengers + demand.destination_daily_passengers) / 2);
});

const DEFAULT_DEPARTURE_HOUR = 9;
const TURNAROUND_HOURS = 1.5;

const showDemandInfo = ref(false);

// Estimated round-trip block time (both legs + turnaround); used to flag overnight rotations
// that cross 24:00 from a standard daytime departure.
const roundTripHours = computed(() => {
  const distance = props.currentPreview?.demand.distance_km ?? 0;

  return Math.max(0.75, distance / 780 + 0.35) * 2 + TURNAROUND_HOURS;
});
const returnsNextDay = computed(() => DEFAULT_DEPARTURE_HOUR + roundTripHours.value > 24);

function airportCode(airport: RouteOpportunity["destination_airport"]): string {
  return airport.iata_code || airport.icao_code || airport.id || "-";
}

function formatDuration(hours: number): string {
  const whole = Math.floor(hours);

  return `${String(whole)}h ${String(Math.round((hours - whole) * 60))}m`;
}

function reasonLabel(reason: { code: string; message: string }): string {
  // BFF sends reason.message === code; translate by code, fall back to the raw code.
  return props.t(`reason.${reason.code}` as NetworkMessageKey) || reason.message;
}
</script>

<template>
  <aside class="flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-surface">
    <div class="border-b border-border px-4 py-3">
      <h2 class="text-subtitle">
        {{ t("panel.preview") }}
      </h2>
    </div>
    <p
      v-if="!currentPreview"
      class="p-4 text-body text-text-muted"
    >
      {{ t("preview.empty") }}
    </p>
    <div
      v-else
      class="min-h-0 flex-1 overflow-y-auto p-4"
    >
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2 min-w-0">
            <span class="text-h3 font-semibold leading-tight shrink-0">
              {{ airportCode(currentPreview.origin_airport) }}
            </span>
            <span class="text-text-muted shrink-0 text-lg">→</span>
            <span class="text-h3 font-semibold leading-tight shrink-0">
              {{ airportCode(currentPreview.destination_airport) }}
            </span>
          </div>
          <div class="mt-1.5 text-caption text-text-muted space-y-0.5 min-w-0">
            <p class="truncate" :title="currentPreview.origin_airport.label">
              {{ currentPreview.origin_airport.label }}
            </p>
            <p class="truncate" :title="currentPreview.destination_airport.label">
              {{ currentPreview.destination_airport.label }}
            </p>
          </div>
        </div>
        <AirBadge
          class="shrink-0"
          :label="recommendationLabel(currentPreview.recommendation)"
          :variant="recommendationVariant(currentPreview.recommendation)"
        />
      </div>
      <div class="mt-4 grid grid-cols-2 gap-2">
        <div class="rounded-md border border-border bg-background px-3 py-2">
          <span class="text-caption text-text-muted">{{ t("metric.distance") }}</span>
          <p class="text-subtitle truncate">
            {{ formatNumber(currentPreview.demand.distance_km) }} {{ t("metric.km") }}
          </p>
        </div>
        <div class="rounded-md border border-border bg-background px-3 py-2">
          <span class="flex items-center gap-1 text-caption text-text-muted">
            {{ t("metric.weekDemand") }}
            <button
              :aria-label="t('demand.info')"
              class="grid size-4 shrink-0 place-items-center rounded-full border border-border text-[10px] font-semibold leading-none text-text-muted transition hover:border-primary hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary"
              :title="t('demand.info')"
              type="button"
              @click="showDemandInfo = true"
            >
              i
            </button>
          </span>
          <p class="text-subtitle truncate">
            {{ formatNumber(averageDailyDemand) }}
          </p>
        </div>
        <div class="rounded-md border border-border bg-background px-3 py-2">
          <span class="text-caption text-text-muted">{{ t("metric.roundTrip") }}</span>
          <p class="text-subtitle flex items-center gap-1.5 flex-wrap">
            <span class="truncate">{{ formatDuration(roundTripHours) }}</span>
            <span
              v-if="returnsNextDay"
              class="rounded bg-warning-soft px-1 text-[10px] font-medium leading-normal text-warning shrink-0"
              :title="t('metric.nextDay')"
            >
              +1d
            </span>
          </p>
        </div>
        <div class="rounded-md border border-border bg-background px-3 py-2">
          <span class="text-caption text-text-muted">{{ t("metric.profit") }}</span>
          <p
            class="text-subtitle truncate"
            :class="currentPreview.economics.estimated_profit_per_flight > 0 ? 'text-success' : 'text-error'"
          >
            {{ formatMoney(currentPreview.economics.estimated_profit_per_flight) }}
          </p>
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

      <div class="mt-3 rounded-md border border-border bg-background p-3">
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
            <div class="flex min-w-0 items-start gap-2">
              <AirAircraftThumb
                :alt="option.type?.model_name"
                :fallback="option.type?.icao_code"
                :image-url="option.type?.image_url"
                size="sm"
              />
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
            </div>
            <AirBadge
              class="shrink-0"
              :label="option.isCompatible ? t('preview.fleet.compatible') : t('preview.fleet.blocked')"
              :variant="option.isCompatible ? 'success-soft' : 'danger-soft'"
            />
          </li>
        </ul>
      </div>
      <div class="mt-3 rounded-md border border-border bg-background p-3">
        <p class="text-caption text-text-muted">
          {{ t("price.title") }}
        </p>
        <p class="mt-1 text-[11px] leading-normal text-text-muted">
          {{ t("price.hint") }}
        </p>
        <div class="mt-3 grid grid-cols-2 gap-3">
          <label class="grid gap-1 text-caption text-text-muted">
            {{ t("price.outbound") }}
            <input
              class="w-full min-w-0 rounded-md border border-border bg-surface px-2 py-1 text-body text-text-primary focus:border-primary focus:outline-none"
              inputmode="numeric"
              min="0"
              :placeholder="t('price.auto')"
              type="number"
              :value="fareOutbound"
              @input="emit('update:fare-outbound', ($event.target as HTMLInputElement).value)"
            />
          </label>
          <label class="grid gap-1 text-caption text-text-muted">
            {{ t("price.return") }}
            <input
              class="w-full min-w-0 rounded-md border border-border bg-surface px-2 py-1 text-body text-text-primary focus:border-primary focus:outline-none"
              inputmode="numeric"
              min="0"
              :placeholder="t('price.auto')"
              type="number"
              :value="fareReturn"
              @input="emit('update:fare-return', ($event.target as HTMLInputElement).value)"
            />
          </label>
        </div>
      </div>
      <AirButton
        class="mt-3 w-full"
        :disabled="isCreating || isPreviewLoading || currentPreview.recommendation === 'blocked'"
        :label="isCreating ? '...' : t('action.create')"
        variant="warning"
        @click="emit('create-selected-route')"
      />
    </div>

    <DemandExplainerModal
      v-if="currentPreview"
      :demand="currentPreview.demand"
      :format-money="formatMoney"
      :format-number="formatNumber"
      :open="showDemandInfo"
      :t="t"
      @close="showDemandInfo = false"
    />
  </aside>
</template>

<style scoped>
/* Hide Chrome/Safari/Edge/Opera spin buttons */
input::-webkit-outer-spin-button,
input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

/* Hide Firefox spin buttons */
input[type="number"] {
  -moz-appearance: textfield;
}
</style>
