<script setup lang="ts">
import type { Locale } from "@airlinesim/i18n";

import { AirBadge, AirButton, AirMetricCard } from "@airlinesim/air-ui";
import { airlineSimEventBus } from "@airlinesim/event-bus";
import { computed, onMounted, ref } from "vue";

import type { FleetMessageKey } from "../i18n";
import type { FlightCard, FlightsResponse } from "../types";

import { completeFlight, getFlights } from "../api";
import { formatMoneyValue, formatNumberValue } from "../formatters";

const props = defineProps<{
  appLocale: Locale;
  t: (key: FleetMessageKey | string) => string;
}>();

const data = ref<FlightsResponse | null>(null);
const error = ref("");
const isLoading = ref(false);

const completedFlights = computed(() => data.value?.flights.filter((flight) => flight.status === "completed") ?? []);
const liveFlights = computed(() =>
  data.value?.flights.filter((flight) => flight.status === "boarding" || flight.status === "in_flight") ?? [],
);
const upcomingFlights = computed(() => data.value?.flights.filter((flight) => flight.status === "scheduled") ?? []);

onMounted(() => {
  void loadFlights();
});

async function complete(id: string): Promise<void> {
  try {
    await completeFlight(id);
    airlineSimEventBus.emit("events:invalidated", { reason: "flight-completed", source: "fleet-ops" });
    airlineSimEventBus.emit("notifications:invalidated", { reason: "flight-completed", source: "fleet-ops" });
    await loadFlights();
  } catch (loadError) {
    error.value = loadError instanceof Error ? loadError.message : props.t("error.operations");
  }
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(props.appLocale, {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatMoney(value: number | undefined): string {
  return formatMoneyValue(props.appLocale, value);
}

function formatNumber(value: number | undefined): string {
  return formatNumberValue(props.appLocale, value);
}

async function loadFlights(): Promise<void> {
  isLoading.value = true;
  error.value = "";

  try {
    data.value = await getFlights();
  } catch (loadError) {
    error.value = loadError instanceof Error ? loadError.message : props.t("error.operations");
  } finally {
    isLoading.value = false;
  }
}

function statusLabel(status: FlightCard["status"]): string {
  return props.t(`flight.status.${status}`);
}

function statusVariant(status: FlightCard["status"]): "danger-soft" | "primary-soft" | "success-soft" | "warning-soft" {
  if (status === "completed") {
    return "success-soft";
  }
  if (status === "boarding" || status === "in_flight") {
    return "warning-soft";
  }
  if (status === "cancelled") {
    return "danger-soft";
  }
  return "primary-soft";
}
</script>

<template>
  <section class="h-full overflow-y-auto bg-background p-4 text-body text-text-primary sm:p-6">
    <header class="flex flex-col gap-4 border-b border-border pb-5 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <AirBadge
          label="Fleet & Ops"
          variant="primary-soft"
        />
        <h1 class="mt-4 text-h2">
          {{ props.t("operations.liveFlights.title") }}
        </h1>
        <p class="mt-2 max-w-2xl text-body text-text-muted">
          {{ props.t("operations.liveFlights.subtitle") }}
        </p>
      </div>
      <AirButton
        :disabled="isLoading"
        :label="props.t('action.refresh')"
        size="sm"
        variant="primary-soft"
        @click="loadFlights"
      />
    </header>

    <div
      v-if="error"
      class="mt-4 rounded-lg border border-error bg-error-bg p-3 text-slate-950"
    >
      {{ error }}
    </div>

    <div class="mt-6 grid gap-3 sm:grid-cols-3">
      <AirMetricCard
        label="Live"
        tone="warning"
        :value="formatNumber(data?.summary.live)"
      />
      <AirMetricCard
        label="Upcoming"
        :value="formatNumber(data?.summary.upcoming)"
      />
      <AirMetricCard
        label="Completed"
        tone="success"
        :value="formatNumber(data?.summary.completed)"
      />
    </div>

    <div
      v-if="!isLoading && !data?.flights.length"
      class="mt-5 rounded-lg border border-border bg-surface p-5 text-text-muted"
    >
      {{ props.t("operations.empty.flights") }}
    </div>

    <div class="mt-5 grid gap-5">
      <section
        v-for="group in [
          { label: 'Live', flights: liveFlights },
          { label: 'Upcoming', flights: upcomingFlights },
          { label: 'Completed', flights: completedFlights },
        ]"
        :key="group.label"
        class="rounded-lg border border-border bg-surface p-4"
      >
        <h2 class="text-subtitle">
          {{ group.label }}
        </h2>
        <div class="mt-3 grid gap-3 lg:grid-cols-2">
          <article
            v-for="flight in group.flights"
            :key="flight.id"
            class="rounded-lg border border-border bg-background p-3"
          >
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <p class="truncate text-subtitle">
                  {{ flight.flight_number }}
                </p>
                <p class="mt-1 text-caption text-text-muted">
                  {{ formatDate(flight.departure_at) }} -> {{ formatDate(flight.arrival_at) }}
                </p>
              </div>
              <AirBadge
                :label="statusLabel(flight.status)"
                :variant="statusVariant(flight.status)"
              />
            </div>
            <div class="mt-3 grid grid-cols-2 gap-2 text-caption text-text-muted">
              <span>{{ formatNumber(flight.expected.passengers) }} pax</span>
              <span>{{ formatNumber(flight.expected.load_factor * 100) }}%</span>
              <span>{{ formatMoney(flight.expected.revenue) }}</span>
              <span>{{ formatMoney(flight.expected.profit) }}</span>
            </div>
            <AirButton
              v-if="flight.status !== 'completed'"
              class="mt-3"
              :label="props.t('action.completeFlight')"
              size="sm"
              variant="primary-soft"
              @click="complete(flight.id)"
            />
          </article>
        </div>
      </section>
    </div>
  </section>
</template>
