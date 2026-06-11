<script setup lang="ts">
import type { Locale } from "@airlinesim/i18n";

import { AirBadge, AirButton, AirMetricCard, AirPagination, AirSegmentedControl, AirStatePanel } from "@airlinesim/air-ui";
import { airlineSimEventBus } from "@airlinesim/event-bus";
import { computed, onMounted, ref, watch } from "vue";

import type { FleetMessageKey } from "../i18n";
import type { FlightCard, FlightsResponse } from "../types";

import { getFlights } from "../api";
import { formatMoneyValue, formatNumberValue } from "../formatters";
import FlightDetailPanel from "./FlightDetailPanel.vue";

const props = defineProps<{
  appLocale: Locale;
  t: (key: FleetMessageKey | string) => string;
}>();

const PAGE_SIZE = 9;

const data = ref<FlightsResponse | null>(null);
const error = ref("");
const isLoading = ref(false);
const page = ref(1);
const search = ref("");
const selectedFlightId = ref("");
const sortKey = ref<"departure" | "profit">("departure");
const statusFilter = ref("all");

const filteredFlights = computed(() =>
  sortedFlights.value.filter((flight) => matchesStatus(flight) && matchesSearch(flight)),
);
const pageCount = computed(() => Math.max(1, Math.ceil(filteredFlights.value.length / PAGE_SIZE)));
const pagedFlights = computed(() => filteredFlights.value.slice((page.value - 1) * PAGE_SIZE, page.value * PAGE_SIZE));
const selectedFlight = computed(() =>
  filteredFlights.value.find((flight) => flight.id === selectedFlightId.value) ?? filteredFlights.value[0] ?? null,
);
const sortOptions = computed(() => [
  { label: props.t("operations.sort.departure"), value: "departure" },
  { label: props.t("operations.sort.profit"), value: "profit" },
]);
const sortedFlights = computed(() => {
  const flights = [...(data.value?.flights ?? [])];

  if (sortKey.value === "profit") {
    return flights.sort((left, right) => right.expected.profit - left.expected.profit);
  }

  return flights.sort((left, right) => left.departure_at.localeCompare(right.departure_at));
});
const totalProfit = computed(() => filteredFlights.value.reduce((sum, flight) => sum + flight.expected.profit, 0));
const viewOptions = computed(() => [
  { label: props.t("operations.filter.all"), value: "all" },
  { label: props.t("operations.filter.live"), value: "live" },
  { label: props.t("operations.board.upcoming"), value: "upcoming" },
  { label: props.t("operations.board.completed"), value: "completed" },
]);

onMounted(() => {
  void loadFlights();
});

// Keep the page in range whenever the visible set shrinks (filter/search/sort change).
watch([statusFilter, search, sortKey], () => {
  page.value = 1;
});
watch(pageCount, (count) => {
  if (page.value > count) {
    page.value = count;
  }
});

function airportCode(airport: FlightCard["origin_airport"], fallbackId: string): string {
  return airport?.iata_code ?? airport?.label ?? fallbackId;
}

function flightDuration(flight: FlightCard): string {
  const minutes = Math.max(0, Math.round((new Date(flight.arrival_at).getTime() - new Date(flight.departure_at).getTime()) / 60_000));

  return `${Math.floor(minutes / 60)}${props.t("unit.hourShort")} ${minutes % 60}${props.t("unit.minuteShort")}`;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(props.appLocale, { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
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
    selectedFlightId.value = data.value.flights[0]?.id ?? "";
  } catch (loadError) {
    error.value = loadError instanceof Error ? loadError.message : props.t("error.operations");
  } finally {
    isLoading.value = false;
  }
}

function matchesSearch(flight: FlightCard): boolean {
  const query = search.value.trim().toLowerCase();

  if (!query) {
    return true;
  }

  return [flight.flight_number, flight.origin_airport_id, flight.destination_airport_id]
    .some((field) => field.toLowerCase().includes(query));
}

function matchesStatus(flight: FlightCard): boolean {
  if (statusFilter.value === "live") {
    return flight.status === "boarding" || flight.status === "in_flight";
  }
  if (statusFilter.value === "upcoming") {
    return flight.status === "scheduled";
  }
  if (statusFilter.value === "completed") {
    return flight.status === "completed" || flight.status === "cancelled";
  }

  return true;
}

// Navigate to the flight's own page (cards lead to their detail page).
function openFlight(flight: FlightCard): void {
  airlineSimEventBus.emit("navigation:intent", {
    source: "mfe",
    targetPath: `/operations/live-flights/${encodeURIComponent(flight.id)}`,
  });
}

function routeLabel(flight: FlightCard): string {
  return `${airportCode(flight.origin_airport, flight.origin_airport_id)} → ${airportCode(flight.destination_airport, flight.destination_airport_id)}`;
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
  <section class="h-full overflow-y-auto bg-background p-3 text-body text-text-primary sm:p-4">
    <div class="mx-auto flex min-h-full max-w-[96rem] flex-col gap-4">
      <header class="flex flex-col gap-3 border-b border-border pb-4 lg:flex-row lg:items-end lg:justify-between">
        <div class="min-w-0">
          <h1 class="text-h2">
            {{ props.t("operations.liveFlights.title") }}
          </h1>
          <p class="mt-1 max-w-3xl text-body text-text-muted">
            {{ props.t("operations.liveFlights.cockpitSubtitle") }}
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

      <AirStatePanel
        v-if="error"
        :body="error"
        :title="props.t('error.operations')"
        tone="danger"
      />

      <section class="grid gap-3 md:grid-cols-4">
        <AirMetricCard
          :label="props.t('operations.metric.live')"
          tone="warning"
          :value="formatNumber(data?.summary.live)"
        />
        <AirMetricCard
          :label="props.t('operations.metric.upcoming')"
          :value="formatNumber(data?.summary.upcoming)"
        />
        <AirMetricCard
          :label="props.t('operations.metric.completed')"
          tone="success"
          :value="formatNumber(data?.summary.completed)"
        />
        <AirMetricCard
          :label="props.t('operations.metric.totalProfit')"
          :tone="totalProfit >= 0 ? 'success' : 'warning'"
          :value="formatMoney(totalProfit)"
        />
      </section>

      <div class="flex flex-col gap-3 rounded-lg border border-border bg-surface p-3 xl:flex-row xl:items-end xl:justify-between">
        <div class="flex flex-wrap items-end gap-4">
          <AirSegmentedControl
            :label="props.t('operations.filter.status')"
            :model-value="statusFilter"
            :options="viewOptions"
            @select="statusFilter = $event"
          />
          <AirSegmentedControl
            :label="props.t('operations.sort')"
            :model-value="sortKey"
            :options="sortOptions"
            @select="sortKey = $event as 'departure' | 'profit'"
          />
        </div>
        <label class="flex min-w-0 flex-col gap-1.5 xl:w-72">
          <span class="text-caption text-text-muted">{{ props.t("filter.search") }}</span>
          <input
            v-model="search"
            class="h-9 rounded-lg border border-border bg-background px-3 text-body outline-none transition focus:border-primary"
            :placeholder="props.t('operations.search.placeholder')"
            type="search"
          />
        </label>
      </div>

      <AirStatePanel
        v-if="!isLoading && !data?.flights.length"
        :body="props.t('operations.empty.flights')"
        :title="props.t('operations.liveFlights.emptyTitle')"
      />

      <div
        v-else
        class="grid gap-4 xl:grid-cols-[minmax(0,1fr)_24rem]"
      >
        <section class="flex min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-surface">
          <div class="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
            <h2 class="text-subtitle">
              {{ props.t("operations.board.dispatcher") }}
            </h2>
            <span class="text-caption text-text-muted">
              {{ formatNumber(filteredFlights.length) }}
            </span>
          </div>

          <div class="min-w-0 overflow-x-auto">
            <table class="w-full min-w-[44rem] border-collapse text-caption">
              <thead>
                <tr class="border-b border-border bg-surface-subtle text-left text-text-muted">
                  <th class="px-4 py-2 font-medium">
                    {{ props.t("operations.table.flight") }}
                  </th>
                  <th class="px-3 py-2 font-medium">
                    {{ props.t("operations.table.route") }}
                  </th>
                  <th class="px-3 py-2 font-medium">
                    {{ props.t("operations.table.status") }}
                  </th>
                  <th class="px-3 py-2 font-medium">
                    {{ props.t("operations.table.departure") }}
                  </th>
                  <th class="px-3 py-2 font-medium">
                    {{ props.t("operations.table.duration") }}
                  </th>
                  <th class="px-3 py-2 text-right font-medium">
                    {{ props.t("operations.table.pax") }}
                  </th>
                  <th class="px-4 py-2 text-right font-medium">
                    {{ props.t("operations.table.profit") }}
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="flight in pagedFlights"
                  :key="flight.id"
                  class="cursor-pointer border-b border-border transition last:border-b-0 hover:bg-surface-subtle"
                  :class="selectedFlight?.id === flight.id ? 'bg-primary-soft/40' : ''"
                  @click="openFlight(flight)"
                  @mouseenter="selectedFlightId = flight.id"
                >
                  <td class="px-4 py-2.5 text-subtitle">
                    <span class="flex flex-wrap items-center gap-1.5">
                      {{ flight.flight_number }}
                      <AirBadge
                        v-if="flight.out_of_position"
                        :label="props.t('flight.outOfPosition')"
                        size="sm"
                        :title="props.t('flight.outOfPosition.hint')"
                        variant="danger-soft"
                      />
                    </span>
                  </td>
                  <td class="whitespace-nowrap px-3 py-2.5 text-text-muted">
                    {{ routeLabel(flight) }}
                  </td>
                  <td class="px-3 py-2.5">
                    <AirBadge
                      :label="statusLabel(flight.status)"
                      size="sm"
                      :variant="statusVariant(flight.status)"
                    />
                  </td>
                  <td class="whitespace-nowrap px-3 py-2.5 text-text-muted">
                    {{ formatDate(flight.departure_at) }}
                  </td>
                  <td class="whitespace-nowrap px-3 py-2.5 text-text-muted">
                    {{ flightDuration(flight) }}
                  </td>
                  <td class="px-3 py-2.5 text-right text-text-muted">
                    {{ formatNumber(flight.expected.passengers) }}
                  </td>
                  <td
                    class="px-4 py-2.5 text-right text-subtitle"
                    :class="flight.expected.profit >= 0 ? 'text-success' : 'text-error'"
                  >
                    {{ formatMoney(flight.expected.profit) }}
                  </td>
                </tr>
                <tr v-if="pagedFlights.length === 0">
                  <td
                    class="px-4 py-10 text-center text-text-muted"
                    colspan="7"
                  >
                    {{ props.t("operations.board.empty") }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <AirPagination
            v-if="filteredFlights.length > PAGE_SIZE"
            :page="page"
            :page-size="PAGE_SIZE"
            :total-items="filteredFlights.length"
            @update:page="page = $event"
          />
        </section>

        <aside class="grid min-w-0 content-start gap-4">
          <FlightDetailPanel
            :app-locale="props.appLocale"
            :flight="selectedFlight"
            :t="props.t"
          />
        </aside>
      </div>
    </div>
  </section>
</template>
