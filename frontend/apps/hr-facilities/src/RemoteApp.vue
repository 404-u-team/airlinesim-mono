<script setup lang="ts">
import type { Locale } from "@airlinesim/i18n";

import { AirBadge, AirButton, AirMetricCard } from "@airlinesim/air-ui";
import { airlineSimEventBus } from "@airlinesim/event-bus";
import { ApiRequestError } from "@airlinesim/game-sdk";
import { computed, onMounted, onUnmounted, ref } from "vue";

import type { FacilitiesOverview } from "./types";

import { getBaseFacilitiesOverview } from "./api";
import AircraftCompatibilityList from "./components/AircraftCompatibilityList.vue";
import SlotCapacityPanel from "./components/SlotCapacityPanel.vue";
import { type FacilitiesMessageKey, t } from "./i18n";

const props = withDefaults(defineProps<{
  appLocale?: Locale;
  remoteId?: string;
  shellPath?: string;
}>(), {
  appLocale: "en",
  remoteId: "hr-facilities",
  shellPath: "/staff/overview",
});
const error = ref("");
const isLoading = ref(false);
const overview = ref<FacilitiesOverview | null>(null);
let unsubscribeSnapshot: (() => void) | null = null;
const message = computed(() => (key: FacilitiesMessageKey): string => t(props.appLocale, key));
const busiestDay = computed(() => overview.value?.slots.days.find((day) => day.day === overview.value?.slots.busiest_day));

onMounted(() => {
  airlineSimEventBus.emit("mfe:ready", { remoteId: "hr-facilities" });
  unsubscribeSnapshot = airlineSimEventBus.on("game:snapshot-invalidated", () => void loadFacilities());
  void loadFacilities();
});
onUnmounted(() => unsubscribeSnapshot?.());

function apiMessage(value: unknown): string {
  if (value instanceof ApiRequestError && value.status === 401) {
    return message.value("error.auth");
  }

  return message.value("error.default");
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat(props.appLocale, {
    currency: "USD",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(value);
}

async function loadFacilities(): Promise<void> {
  isLoading.value = true;
  error.value = "";

  try {
    overview.value = await getBaseFacilitiesOverview();
  } catch (loadError) {
    error.value = apiMessage(loadError);
  } finally {
    isLoading.value = false;
  }
}

function navigate(targetPath: string): void {
  airlineSimEventBus.emit("navigation:intent", { source: "mfe", targetPath });
}
</script>

<template>
  <section class="min-h-full overflow-x-hidden bg-background p-4 text-body text-text-primary sm:p-6">
    <header class="flex flex-col gap-4 border-b border-border pb-5 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <AirBadge :label="message(`status.${overview?.status ?? 'missing'}`)" :variant="overview?.status === 'ready' ? 'success-soft' : overview?.status === 'blocked' ? 'danger-soft' : 'warning-soft'" />
        <h1 class="mt-4 text-h2">
          {{ message("title") }}
        </h1>
        <p class="mt-2 max-w-3xl text-body text-text-muted">
          {{ message("description") }}
        </p>
      </div>
      <AirButton
        :disabled="isLoading"
        :label="message('action.refresh')"
        size="sm"
        @click="loadFacilities"
      />
    </header>

    <div v-if="error" class="mt-4 rounded-lg border border-error bg-error-bg p-3 text-slate-950">
      {{ error }}
    </div>
    <div v-else-if="isLoading && !overview" class="mt-6 rounded-lg border border-border bg-surface p-8 text-center text-text-muted">
      {{ message("loading") }}
    </div>
    <div v-else-if="overview && !overview.base_airport" class="mt-6 rounded-lg border border-border bg-surface p-8 text-center">
      <h2 class="text-h3">
        {{ message("empty.title") }}
      </h2>
      <p class="mt-2 text-text-muted">
        {{ message("empty.description") }}
      </p>
      <AirButton class="mt-4" :label="message('action.SELECT_BASE')" @click="navigate('/onboarding/airline')" />
    </div>

    <template v-else-if="overview?.base_airport">
      <div class="mt-6 rounded-lg border border-border bg-surface p-4">
        <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 class="text-h3">
              {{ overview.base_airport.label }}
            </h2>
            <p class="mt-1 text-text-muted">
              {{ overview.base_airport.municipality ?? "-" }} · {{ overview.base_airport.timezone ?? "-" }}
            </p>
          </div>
          <AirBadge :label="overview.base_airport.iata_code ?? overview.base_airport.icao_code ?? 'BASE'" size="lg" />
        </div>
      </div>

      <div class="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <AirMetricCard :label="message('metric.runway')" :value="`${overview.runway.max_length_m} m`" />
        <AirMetricCard :label="message('metric.aircraft')" :value="String(overview.aircraft_compatibility.length)" />
        <AirMetricCard :label="message('metric.slots')" :tone="(busiestDay?.utilization ?? 0) > 1 ? 'danger' : (busiestDay?.utilization ?? 0) >= 0.8 ? 'warning' : 'neutral'" :value="`${busiestDay?.current ?? 0} / ${busiestDay?.capacity ?? 0}`" />
        <AirMetricCard :label="message('metric.night')" :tone="overview.night_operations.enabled ? 'success' : 'warning'" :value="message(overview.night_operations.enabled ? 'night.enabled' : 'night.prohibited')" />
      </div>

      <div v-if="overview.constraints.length" class="mt-4 grid gap-2 lg:grid-cols-2">
        <button
          v-for="constraint in overview.constraints"
          :key="`${constraint.code}-${String(constraint.parameters.day ?? '')}`"
          class="rounded-lg border p-3 text-left"
          :class="constraint.blocking ? 'border-error bg-error-bg' : 'border-warning bg-warning-bg'"
          type="button"
          @click="navigate(constraint.target_path)"
        >
          <strong>{{ message(`constraint.${constraint.code}`) }}</strong>
        </button>
      </div>

      <SlotCapacityPanel class="mt-4" :locale="appLocale" :slots="overview.slots" />
      <AircraftCompatibilityList class="mt-4" :items="overview.aircraft_compatibility" :locale="appLocale" />

      <section class="mt-4 rounded-lg border border-border bg-surface p-4">
        <h2 class="text-subtitle">
          {{ message("cost.title") }}
        </h2>
        <p class="mt-1 text-text-muted">
          {{ message("cost.description") }}
        </p>
        <div class="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <AirMetricCard :label="message('cost.runway')" :value="formatMoney(overview.costs.runway_fee)" />
          <AirMetricCard :label="message('cost.gate')" :value="formatMoney(overview.costs.gate_fee)" />
          <AirMetricCard :label="message('cost.stand')" :value="formatMoney(overview.costs.stand_fee)" />
          <AirMetricCard :label="message('cost.turnaround')" :value="formatMoney(overview.costs.turnaround_point_price)" />
          <AirMetricCard :label="message('cost.estimated')" :value="formatMoney(overview.costs.estimated_cost_per_operation)" />
        </div>
      </section>

      <div class="mt-4 flex flex-wrap gap-2">
        <AirButton
          v-for="action in overview.next_actions"
          :key="action.code"
          :label="message(`action.${action.code}`)"
          size="sm"
          variant="primary-soft"
          @click="navigate(action.target_path)"
        />
      </div>
    </template>
  </section>
</template>
