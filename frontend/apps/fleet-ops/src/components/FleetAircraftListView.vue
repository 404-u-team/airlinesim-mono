<script setup lang="ts">
import { AirBadge, AirButton, AirPagination, AirSelect, AirStatePanel, AirTextField } from "@airlinesim/air-ui";
import { computed, ref, watch } from "vue";

import type { FleetOwnedAircraftCard } from "../types";

const props = defineProps<{
  aircraft: FleetOwnedAircraftCard[];
  error: string;
  formatNumber: (value: number | undefined) => string;
  formatPercent: (value: number | undefined) => string;
  isLoading: boolean;
  t: (key: string) => string;
}>();

const emit = defineEmits<{
  navigate: [path: string];
  refresh: [];
}>();

const PAGE_SIZE = 8;

const page = ref(1);
const query = ref("");
const status = ref("all");

const filteredAircraft = computed(() => {
  const normalizedQuery = query.value.trim().toLowerCase();

  return props.aircraft.filter((aircraft) => {
    const matchesQuery = normalizedQuery
      ? matchesAircraftQuery(aircraft, normalizedQuery)
      : true;
    const matchesStatus = status.value === "all" || getAircraftStatus(aircraft) === status.value;

    return matchesQuery && matchesStatus;
  });
});
const pageAircraft = computed(() => {
  const start = (page.value - 1) * PAGE_SIZE;

  return filteredAircraft.value.slice(start, start + PAGE_SIZE);
});
const statusOptions = computed(() => [
  { label: props.t("fleet.filter.status.all"), value: "all" },
  { label: props.t("fleet.filter.status.inService"), value: "in_service" },
  { label: props.t("fleet.filter.status.unassigned"), value: "unassigned" },
  { label: props.t("fleet.filter.status.maintenance"), value: "maintenance" },
]);

watch([query, status], () => {
  page.value = 1;
});

function getAircraftStatus(aircraft: FleetOwnedAircraftCard): string {
  if (aircraft.maintenanceRatio < 0.35) {
    return "maintenance";
  }
  if (aircraft.in_service) {
    return "in_service";
  }

  return aircraft.assignment.status;
}

function matchesAircraftQuery(aircraft: FleetOwnedAircraftCard, normalizedQuery: string): boolean {
  const values = [aircraft.tail_number, aircraft.modelName, aircraft.baseAirportName];

  return values.some((value) => Boolean(value?.toLowerCase().includes(normalizedQuery)));
}

function openAircraft(aircraft: FleetOwnedAircraftCard): void {
  if (!aircraft.id) {
    return;
  }

  emit("navigate", `/fleet/aircraft/${encodeURIComponent(aircraft.id)}`);
}

function statusLabel(aircraft: FleetOwnedAircraftCard): string {
  const aircraftStatus = getAircraftStatus(aircraft);
  const key = `fleet.filter.status.${aircraftStatus === "in_service" ? "inService" : aircraftStatus}`;

  return props.t(key);
}

function statusVariant(aircraft: FleetOwnedAircraftCard): "primary-soft" | "success-soft" | "warning-soft" {
  const aircraftStatus = getAircraftStatus(aircraft);
  if (aircraftStatus === "maintenance") {
    return "warning-soft";
  }
  if (aircraftStatus === "in_service") {
    return "success-soft";
  }

  return "primary-soft";
}
</script>

<template>
  <div class="flex min-h-full flex-col gap-4">
    <header class="flex flex-col gap-3 border-b border-border pb-4 lg:flex-row lg:items-center lg:justify-between">
      <div class="min-w-0">
        <h1 class="text-h2">
          {{ t("fleet.aircraft.title") }}
        </h1>
        <p class="mt-1 max-w-3xl text-body text-text-muted">
          {{ t("fleet.aircraft.subtitle") }}
        </p>
      </div>
      <div class="flex flex-wrap gap-2">
        <AirButton
          :disabled="isLoading"
          :label="t('action.refresh')"
          size="sm"
          variant="primary-soft"
          @click="emit('refresh')"
        />
        <AirButton
          :label="t('fleet.action.order')"
          size="sm"
          @click="emit('navigate', '/fleet/order/new')"
        />
      </div>
    </header>

    <AirStatePanel
      v-if="error"
      :body="error"
      :title="t('error.load')"
      tone="danger"
    />

    <section class="rounded-lg border border-border bg-surface">
      <div class="grid gap-3 border-b border-border p-4 lg:grid-cols-[minmax(16rem,1fr)_14rem_auto] lg:items-end">
        <AirTextField
          v-model="query"
          :label="t('fleet.filter.search')"
          :placeholder="t('fleet.filter.search.placeholder')"
          type="search"
        />
        <AirSelect
          v-model="status"
          :label="t('fleet.filter.status')"
          :options="statusOptions"
        />
        <AirButton
          :label="t('fleet.action.overview')"
          size="sm"
          variant="primary-soft"
          @click="emit('navigate', '/fleet/overview')"
        />
      </div>

      <div class="fleet-aircraft-table">
        <button
          v-for="aircraftItem in pageAircraft"
          :key="aircraftItem.id"
          class="grid w-full min-w-0 gap-3 border-b border-border px-4 py-3 text-left transition last:border-b-0 hover:bg-background lg:grid-cols-[minmax(16rem,1.1fr)_minmax(10rem,0.8fr)_repeat(3,minmax(7rem,0.45fr))_auto] lg:items-center"
          type="button"
          @click="openAircraft(aircraftItem)"
        >
          <span class="flex min-w-0 items-center gap-3">
            <span class="grid size-12 shrink-0 place-items-center overflow-hidden rounded-lg border border-border bg-background text-caption text-text-muted">
              <img
                v-if="aircraftItem.type?.image_url"
                :alt="aircraftItem.modelName"
                class="size-full object-cover"
                loading="lazy"
                :src="aircraftItem.type.image_url"
              />
              <template v-else>{{ aircraftItem.type?.icao_code ?? "----" }}</template>
            </span>
            <span class="min-w-0">
              <span class="block truncate text-subtitle">{{ aircraftItem.tail_number ?? aircraftItem.id }}</span>
              <span class="mt-0.5 block truncate text-caption text-text-muted">{{ aircraftItem.modelName }}</span>
            </span>
          </span>
          <span class="min-w-0 text-body">
            <span class="block truncate text-text-primary">{{ aircraftItem.baseAirportName }}</span>
            <span class="text-caption text-text-muted">{{ t("market.base") }}</span>
          </span>
          <span class="text-body">
            <span class="block text-text-primary">{{ formatPercent(aircraftItem.maintenanceRatio) }}</span>
            <span class="text-caption text-text-muted">{{ t("metric.maintenance") }}</span>
          </span>
          <span class="text-body">
            <span class="block text-text-primary">{{ formatNumber(aircraftItem.total_flight_hours) }}</span>
            <span class="text-caption text-text-muted">{{ t("metric.hours") }}</span>
          </span>
          <span class="text-body">
            <span class="block text-text-primary">{{ formatNumber(aircraftItem.total_cycles) }}</span>
            <span class="text-caption text-text-muted">{{ t("metric.cycles") }}</span>
          </span>
          <AirBadge
            :label="statusLabel(aircraftItem)"
            size="sm"
            :variant="statusVariant(aircraftItem)"
          />
        </button>

        <p
          v-if="!isLoading && filteredAircraft.length === 0"
          class="p-6 text-body text-text-muted"
        >
          {{ t("aircraft.empty") }}
        </p>
      </div>

      <AirPagination
        v-model:page="page"
        :disabled="isLoading"
        :page-size="PAGE_SIZE"
        :total-items="filteredAircraft.length"
      />
    </section>
  </div>
</template>

<style scoped>
.fleet-aircraft-table {
  min-height: 24rem;
}
</style>
