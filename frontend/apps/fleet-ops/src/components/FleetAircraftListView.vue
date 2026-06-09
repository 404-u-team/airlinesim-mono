<script setup lang="ts">
import { AirButton, AirIconButton, AirPagination, AirStatePanel, AirTextField } from "@airlinesim/air-ui";
import { computed, ref, watch } from "vue";

import type { FleetOwnedAircraftCard } from "../types";

import { getAircraftStatus, getProgressBarTone, getSortValue, statusLabel, statusVariant } from "../fleet-controller-helpers";
import FleetAircraftGridCard from "./FleetAircraftGridCard.vue";
import FleetAircraftListRow from "./FleetAircraftListRow.vue";

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

const PAGE_SIZE = 12;
const page = ref(1);
const query = ref("");
const status = ref("all");
const sortBy = ref("tail_number");
const sortOrder = ref<"asc" | "desc">("asc");
const viewMode = ref<"grid" | "list">((localStorage.getItem("fleet_aircraft_view_mode") as "grid" | "list") || "grid");

watch(viewMode, (newMode) => { localStorage.setItem("fleet_aircraft_view_mode", newMode); });

const filteredAircraft = computed(() => {
  const normalizedQuery = query.value.trim().toLowerCase();
  return props.aircraft.filter((aircraft) => {
    const matchesQuery = normalizedQuery ? matchesAircraftQuery(aircraft, normalizedQuery) : true;
    const matchesStatus = status.value === "all" || getAircraftStatus(aircraft) === status.value;
    return matchesQuery && matchesStatus;
  });
});

const sortedAndFilteredAircraft = computed(() => {
  const list = [...filteredAircraft.value];
  const field = sortBy.value;
  const order = sortOrder.value;
  return list.sort((a, b) => {
    const valA = getSortValue(a, field);
    const valB = getSortValue(b, field);
    if (typeof valA === "string" && typeof valB === "string") {
      const cmp = valA.localeCompare(valB);
      return order === "asc" ? cmp : -cmp;
    }
    const numA = Number(valA);
    const numB = Number(valB);
    return order === "asc" ? numA - numB : numB - numA;
  });
});

const pageAircraft = computed(() => {
  const start = (page.value - 1) * PAGE_SIZE;
  return sortedAndFilteredAircraft.value.slice(start, start + PAGE_SIZE);
});

const statusOptions = computed(() => [
  { label: props.t("fleet.filter.status.all"), value: "all" },
  { label: props.t("fleet.filter.status.inService"), value: "in_service" },
  { label: props.t("fleet.filter.status.unassigned"), value: "unassigned" },
  { label: props.t("fleet.filter.status.maintenance"), value: "maintenance" },
]);

const sortOptions = computed(() => [
  { label: props.t("fleet.sort.tailNumber"), value: "tail_number" },
  { label: props.t("fleet.sort.model"), value: "model" },
  { label: props.t("fleet.sort.maintenance"), value: "maintenance" },
  { label: props.t("fleet.sort.hours"), value: "hours" },
  { label: props.t("fleet.sort.cycles"), value: "cycles" },
]);

watch([query, status, sortBy, sortOrder], () => { page.value = 1; });

function matchesAircraftQuery(aircraft: FleetOwnedAircraftCard, normalizedQuery: string): boolean {
  const values = [aircraft.tail_number, aircraft.modelName, aircraft.baseAirportName];
  return values.some((value) => Boolean(value?.toLowerCase().includes(normalizedQuery)));
}

function openAircraft(aircraft: FleetOwnedAircraftCard): void {
  if (aircraft.id) { emit("navigate", `/fleet/aircraft/${encodeURIComponent(aircraft.id)}`); }
}

function toggleSortOrder(): void { sortOrder.value = sortOrder.value === "asc" ? "desc" : "asc"; }
</script>

<template>
  <div class="flex min-h-full flex-col gap-4 pb-8">
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
        <AirButton :label="t('fleet.action.order')" size="sm" @click="emit('navigate', '/fleet/order/new')" />
      </div>
    </header>

    <AirStatePanel
      v-if="error"
      :body="error"
      :title="t('error.load')"
      tone="danger"
    />

    <!-- Filters and Sorting Toolbar -->
    <section class="rounded-xl border border-border bg-surface p-4">
      <div class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div class="grid flex-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:max-w-4xl">
          <AirTextField
            v-model="query"
            :label="t('fleet.filter.search')"
            :placeholder="t('fleet.filter.search.placeholder')"
            type="search"
          />

          <!-- Status Dropdown -->
          <div class="flex min-w-0 flex-col gap-1.5">
            <span class="text-caption text-text-muted select-none">{{ t('fleet.filter.status') }}</span>
            <select v-model="status" class="h-11 rounded-lg border border-border bg-surface px-3 text-body text-text-primary outline-none transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
              <option v-for="option in statusOptions" :key="option.value" :value="option.value">
                {{ option.label }}
              </option>
            </select>
          </div>

          <!-- Sort Dropdown -->
          <div class="flex min-w-0 flex-col gap-1.5">
            <span class="text-caption text-text-muted select-none">{{ t('fleet.sort.by') }}</span>
            <div class="flex gap-2">
              <select v-model="sortBy" class="h-11 flex-1 rounded-lg border border-border bg-surface px-3 text-body text-text-primary outline-none transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
                <option v-for="option in sortOptions" :key="option.value" :value="option.value">
                  {{ option.label }}
                </option>
              </select>
              <AirIconButton
                :label="t('fleet.sort.direction')"
                size="md"
                variant="surface"
                class="!h-11 !w-11"
                @click="toggleSortOrder"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  class="transition-transform duration-200"
                  :class="{ 'rotate-180': sortOrder === 'desc' }"
                >
                  <line
                    x1="12"
                    y1="5"
                    x2="12"
                    y2="19"
                  />
                  <polyline points="19 12 12 19 5 12" />
                </svg>
              </AirIconButton>
            </div>
          </div>
        </div>

        <div class="flex flex-col gap-1.5 justify-end">
          <span class="text-caption text-transparent select-none hidden lg:inline-block">Spacer</span>
          <div class="flex items-center justify-between gap-3 border-t border-border pt-4 lg:border-t-0 lg:pt-0">
            <!-- View Toggle Mode Buttons -->
            <div class="flex rounded-lg border border-border bg-background p-0.5 h-11 items-center">
              <button
                class="flex h-full items-center justify-center rounded-md px-3 text-caption transition-all duration-200"
                :class="viewMode === 'grid' ? 'bg-surface font-semibold text-text-primary shadow-sm' : 'text-text-muted hover:text-text-primary'"
                type="button"
                @click="viewMode = 'grid'"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  class="mr-1.5"
                >
                  <rect
                    x="3"
                    y="3"
                    width="7"
                    height="7"
                  />
                  <rect
                    x="14"
                    y="3"
                    width="7"
                    height="7"
                  />
                  <rect
                    x="14"
                    y="14"
                    width="7"
                    height="7"
                  />
                  <rect
                    x="3"
                    y="14"
                    width="7"
                    height="7"
                  />
                </svg>
                {{ t('fleet.view.grid') }}
              </button>
              <button
                class="flex h-full items-center justify-center rounded-md px-3 text-caption transition-all duration-200"
                :class="viewMode === 'list' ? 'bg-surface font-semibold text-text-primary shadow-sm' : 'text-text-muted hover:text-text-primary'"
                type="button"
                @click="viewMode = 'list'"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  class="mr-1.5"
                >
                  <line
                    x1="8"
                    y1="6"
                    x2="21"
                    y2="6"
                  />
                  <line
                    x1="8"
                    y1="12"
                    x2="21"
                    y2="12"
                  />
                  <line
                    x1="8"
                    y1="18"
                    x2="21"
                    y2="18"
                  />
                  <line
                    x1="3"
                    y1="6"
                    x2="3.01"
                    y2="6"
                  />
                  <line
                    x1="3"
                    y1="12"
                    x2="3.01"
                    y2="12"
                  />
                  <line
                    x1="3"
                    y1="18"
                    x2="3.01"
                    y2="18"
                  />
                </svg>
                {{ t('fleet.view.list') }}
              </button>
            </div>
            <AirButton
              :label="t('fleet.action.overview')"
              size="md"
              variant="primary-soft"
              class="!h-11"
              @click="emit('navigate', '/fleet/overview')"
            />
          </div>
        </div>
      </div>
    </section>

    <!-- Grid Layout View -->
    <div v-if="viewMode === 'grid'" class="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
      <FleetAircraftGridCard
        v-for="aircraftItem in pageAircraft"
        :key="aircraftItem.id"
        :aircraft-item="aircraftItem"
        :format-number="formatNumber"
        :format-percent="formatPercent"
        :progress-bar-tone="getProgressBarTone(aircraftItem.maintenanceRatio)"
        :status-label="statusLabel(aircraftItem, t)"
        :status-variant="statusVariant(aircraftItem)"
        :t="t"
        @click="openAircraft(aircraftItem)"
      />
    </div>

    <!-- List Layout View -->
    <div v-else class="rounded-xl border border-border bg-surface overflow-hidden">
      <div class="divide-y divide-border">
        <FleetAircraftListRow
          v-for="aircraftItem in pageAircraft"
          :key="aircraftItem.id"
          :aircraft-item="aircraftItem"
          :format-number="formatNumber"
          :format-percent="formatPercent"
          :progress-bar-tone="getProgressBarTone(aircraftItem.maintenanceRatio)"
          :status-label="statusLabel(aircraftItem, t)"
          :status-variant="statusVariant(aircraftItem)"
          :t="t"
          @click="openAircraft(aircraftItem)"
        />
      </div>
    </div>

    <!-- Empty and Pagination -->
    <div class="mt-2 flex flex-col gap-4">
      <p v-if="!isLoading && filteredAircraft.length === 0" class="rounded-xl border border-border bg-surface p-8 text-center text-body text-text-muted">
        {{ t("aircraft.empty") }}
      </p>
      <div class="flex justify-end rounded-xl border border-border bg-surface p-2">
        <AirPagination
          v-model:page="page"
          :disabled="isLoading"
          :page-size="PAGE_SIZE"
          :total-items="filteredAircraft.length"
        />
      </div>
    </div>
  </div>
</template>
