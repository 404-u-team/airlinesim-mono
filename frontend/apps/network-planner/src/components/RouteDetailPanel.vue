<script setup lang="ts">
import type { Locale } from "@airlinesim/i18n";

import { AirButton, AirStatePanel } from "@airlinesim/air-ui";
import { airlineSimEventBus } from "@airlinesim/event-bus";
import { onMounted, ref, watch } from "vue";

import type { NetworkMessageKey } from "../i18n";
import type {
  PriceAnalysisResponse,
  RouteAirport,
  RouteDetailFlight,
  RouteDetailResponse,
  RouteFlightFinancials,
} from "../types";

import { getRouteDetail, requestPriceAnalysis, updateRouteFare } from "../api";
import { useRouteDetailMap } from "../useRouteDetailMap";
import DemandExplainerModal from "./DemandExplainerModal.vue";
import RouteDetailAircraftCard from "./RouteDetailAircraftCard.vue";
import RouteDetailSidebar from "./RouteDetailSidebar.vue";

const props = defineProps<{
  appLocale: Locale;
  appTheme: "dark" | "light";
  routeId: string;
  t: (key: NetworkMessageKey) => string;
}>();

// Short-haul fare elasticity — mirrors the BFF so the live forecast matches the
// numbers the server will compute once the price is applied.
const FARE_ELASTICITY = 1.1;

const analysis = ref<null | PriceAnalysisResponse["analysis"]>(null);
const analysisError = ref("");
const detail = ref<null | RouteDetailResponse>(null);
const error = ref("");
const fareOutbound = ref("");
const fareReturn = ref("");
const isAnalyzing = ref(false);
const isLoading = ref(false);
const isSaving = ref(false);
const showDemandInfo = ref(false);
const mapContainer = ref<HTMLElement | null>(null);

useRouteDetailMap(mapContainer, () => detail.value?.route, () => props.appTheme);

onMounted(() => {
  void load();
});

watch(() => props.routeId, () => {
  void load();
});

function airportCode(airport: null | RouteAirport | undefined): string {
  return airport?.iata_code || airport?.icao_code || airport?.id || "—";
}

function applySuggestedFares(): void {
  if (!analysis.value) {
    return;
  }
  fareOutbound.value = String(analysis.value.outbound.suggested_fare);
  fareReturn.value = String(analysis.value.return.suggested_fare);
}

function back(): void {
  airlineSimEventBus.emit("navigation:intent", { source: "mfe", targetPath: "/airports/my-routes" });
}

function fareInputFor(leg: "outbound" | "return"): null | number {
  const raw = leg === "outbound" ? fareOutbound.value : fareReturn.value;
  const parsed = Number(raw);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function flightLeg(flight: RouteDetailFlight): "outbound" | "return" {
  const originId = detail.value?.route.origin_airport?.id;

  return flight.origin_airport?.id && originId && flight.origin_airport.id === originId ? "outbound" : "return";
}

// Client-side forecast for a flight at the entered fare, using relative elasticity
// from its current expected numbers (reference fare cancels in the ratio).
function forecastFlight(flight: RouteDetailFlight): RouteFlightFinancials {
  const entered = fareInputFor(flightLeg(flight));
  const base = flight.expected;
  const currentFare = base.passengers > 0 ? base.revenue / base.passengers : 0;
  if (!entered || currentFare <= 0) {
    return base;
  }
  const seats = base.load_factor > 0 ? base.passengers / base.load_factor : base.passengers;
  const scaled = base.passengers * (entered / currentFare) ** -FARE_ELASTICITY;
  const passengers = Math.max(0, Math.round(Math.min(scaled, seats * 0.92)));
  const revenue = Math.round(entered * passengers);

  return {
    cost: base.cost,
    load_factor: seats > 0 ? Number(Math.min(passengers / seats, 0.92).toFixed(2)) : base.load_factor,
    passengers,
    profit: revenue - base.cost,
    revenue,
  };
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat(props.appLocale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function formatMoney(value: number | undefined): string {
  return new Intl.NumberFormat(props.appLocale, {
    currency: "USD",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(value ?? 0);
}

function formatNumber(value: number | undefined): string {
  return new Intl.NumberFormat(props.appLocale, { maximumFractionDigits: 0 }).format(value ?? 0);
}

async function load(): Promise<void> {
  isLoading.value = true;
  error.value = "";
  analysis.value = null;
  analysisError.value = "";

  try {
    const response = await getRouteDetail(props.routeId);
    detail.value = response;
    fareOutbound.value = response.fare.outbound === null ? "" : String(response.fare.outbound);
    fareReturn.value = response.fare.return === null ? "" : String(response.fare.return);
  } catch (loadError) {
    error.value = loadError instanceof Error ? loadError.message : props.t("error.load");
  } finally {
    isLoading.value = false;
  }
}

function openAircraft(aircraftId: string): void {
  airlineSimEventBus.emit("navigation:intent", { source: "mfe", targetPath: `/fleet/aircraft/${encodeURIComponent(aircraftId)}` });
}

async function runAnalysis(): Promise<void> {
  isAnalyzing.value = true;
  analysisError.value = "";

  try {
    const response = await requestPriceAnalysis(props.routeId);
    analysis.value = response.analysis;
    airlineSimEventBus.emit("game:snapshot-invalidated", { reason: "manual-refresh", source: "network-planner" });
  } catch (analysisFailure) {
    analysisError.value = analysisFailure instanceof Error ? analysisFailure.message : props.t("detail.analysis.error");
  } finally {
    isAnalyzing.value = false;
  }
}

async function saveFare(): Promise<void> {
  isSaving.value = true;
  error.value = "";

  try {
    await updateRouteFare(props.routeId, { outbound: fareInputFor("outbound"), return: fareInputFor("return") });
    airlineSimEventBus.emit("game:snapshot-invalidated", { reason: "manual-refresh", source: "network-planner" });
    await load();
  } catch (saveError) {
    error.value = saveError instanceof Error ? saveError.message : props.t("error.load");
  } finally {
    isSaving.value = false;
  }
}
</script>

<template>
  <section class="route-detail-shell h-full overflow-y-auto bg-background p-3 text-body text-text-primary sm:p-4">
    <div class="mb-3 flex items-center gap-3">
      <AirButton
        :label="t('detail.back')"
        size="sm"
        variant="primary-soft"
        @click="back"
      />
      <h1
        v-if="detail"
        class="text-h2"
      >
        {{ airportCode(detail.route.origin_airport) }} → {{ airportCode(detail.route.destination_airport) }}
      </h1>
    </div>

    <AirStatePanel
      v-if="error"
      :body="error"
      :title="t('error.load')"
      tone="danger"
    />

    <div
      v-else-if="detail"
      class="grid gap-3 xl:grid-cols-[minmax(0,1fr)_24rem]"
    >
      <div class="grid gap-3">
        <div class="overflow-hidden rounded-lg border border-border bg-surface">
          <div
            ref="mapContainer"
            class="route-detail-map"
          />
        </div>

        <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div class="rounded-md border border-border bg-surface px-3 py-2">
            <p class="text-caption text-text-muted">
              {{ t("detail.demand.outbound") }}
            </p>
            <p class="text-subtitle">
              {{ formatNumber(detail.demand.origin_daily_passengers) }}
            </p>
          </div>
          <div class="rounded-md border border-border bg-surface px-3 py-2">
            <p class="text-caption text-text-muted">
              {{ t("detail.demand.return") }}
            </p>
            <p class="text-subtitle">
              {{ formatNumber(detail.demand.destination_daily_passengers) }}
            </p>
          </div>
          <div class="rounded-md border border-border bg-surface px-3 py-2">
            <span class="flex items-center gap-1 text-caption text-text-muted">
              {{ t("detail.demand.average") }}
              <button
                :aria-label="t('demand.info')"
                class="grid size-4 shrink-0 place-items-center rounded-full border border-border text-[10px] font-semibold leading-none text-text-muted transition hover:border-primary hover:text-primary"
                :title="t('demand.info')"
                type="button"
                @click="showDemandInfo = true"
              >
                i
              </button>
            </span>
            <p class="text-subtitle">
              {{ formatNumber(detail.demand.average_daily_passengers) }}
            </p>
          </div>
          <div class="rounded-md border border-border bg-surface px-3 py-2">
            <p class="text-caption text-text-muted">
              {{ t("metric.distance") }}
            </p>
            <p class="text-subtitle">
              {{ formatNumber(detail.demand.distance_km) }} {{ t("metric.km") }}
            </p>
          </div>
        </div>

        <div class="rounded-lg border border-border bg-surface p-4">
          <h2 class="text-subtitle">
            {{ t("detail.flights.title") }}
          </h2>
          <p
            v-if="detail.upcoming_flights.length === 0"
            class="mt-2 text-caption text-text-muted"
          >
            {{ t("detail.flights.empty") }}
          </p>
          <ul
            v-else
            class="mt-2 grid gap-2"
          >
            <li
              v-for="flight in detail.upcoming_flights"
              :key="flight.id"
              class="grid grid-cols-[1fr_auto] items-center gap-2 rounded-md border border-border bg-background px-3 py-2"
            >
              <div class="min-w-0">
                <p class="text-body">
                  {{ flight.flight_number }}
                  <span class="text-text-muted">· {{ airportCode(flight.origin_airport) }} → {{ airportCode(flight.destination_airport) }}</span>
                </p>
                <p class="text-caption text-text-muted">
                  {{ formatDateTime(flight.departure_at) }}
                </p>
              </div>
              <div class="text-right">
                <p
                  class="text-body"
                  :class="forecastFlight(flight).profit > 0 ? 'text-success' : 'text-error'"
                >
                  {{ formatMoney(forecastFlight(flight).profit) }}
                </p>
                <p class="text-caption text-text-muted">
                  {{ forecastFlight(flight).passengers }} pax · {{ Math.round(forecastFlight(flight).load_factor * 100) }}%
                </p>
              </div>
            </li>
          </ul>
        </div>

        <div class="rounded-lg border border-border bg-surface p-4">
          <h2 class="text-subtitle">
            {{ t("detail.aircraft.title") }}
          </h2>
          <p
            v-if="detail.aircraft.length === 0"
            class="mt-2 text-caption text-text-muted"
          >
            {{ t("detail.aircraft.empty") }}
          </p>
          <ul
            v-else
            class="mt-2 grid gap-2"
          >
            <li
              v-for="item in detail.aircraft"
              :key="item.id ?? item.tail_number"
            >
              <RouteDetailAircraftCard
                :aircraft="item"
                :t="t"
                @open="openAircraft"
              />
            </li>
          </ul>
        </div>
      </div>

      <RouteDetailSidebar
        :analysis="analysis"
        :analysis-error="analysisError"
        :fare-outbound="fareOutbound"
        :fare-return="fareReturn"
        :format-money="formatMoney"
        :is-analyzing="isAnalyzing"
        :is-saving="isSaving"
        :schedules="detail.schedules"
        :t="t"
        @analyze="runAnalysis"
        @apply="applySuggestedFares"
        @save="saveFare"
        @update:fare-outbound="fareOutbound = $event"
        @update:fare-return="fareReturn = $event"
      />
    </div>

    <DemandExplainerModal
      v-if="detail"
      :demand="detail.route.demand_snapshot"
      :format-money="formatMoney"
      :format-number="formatNumber"
      :open="showDemandInfo"
      :t="t"
      @close="showDemandInfo = false"
    />
  </section>
</template>

<style scoped>
.route-detail-map {
  height: 22rem;
  width: 100%;
}
</style>
