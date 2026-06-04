<script setup lang="ts">
import type { Locale } from "@airlinesim/i18n";

import { AirBadge, AirButton, AirMetricCard, AirTextField } from "@airlinesim/air-ui";
import { airlineSimEventBus } from "@airlinesim/event-bus";
import { computed, onMounted, reactive, ref } from "vue";

import type { RouteOpportunity, StoredRoute } from "./types";

import { createRoute, getRouteOpportunities, getRoutePreview, getRoutes } from "./api";
import RouteListPanel from "./components/RouteListPanel.vue";
import RouteOpportunityGrid from "./components/RouteOpportunityGrid.vue";
import RoutePreviewPanel from "./components/RoutePreviewPanel.vue";
import { type NetworkMessageKey, t as translateNetwork } from "./i18n";

const props = defineProps<{
  appLocale: Locale;
  shellPath?: string;
}>();

const error = ref("");
const isCreating = ref(false);
const isLoading = ref(false);
const isPreviewLoading = ref(false);
const message = ref("");
const opportunities = ref<RouteOpportunity[]>([]);
const preview = ref<null | RouteOpportunity>(null);
const routes = ref<StoredRoute[]>([]);
const selectedDestinationId = ref("");
const selectedAircraftId = ref("");
const filters = reactive({
  maxDistance: "",
  minDemand: "",
  onlyCompatible: false,
  onlyProfitable: false,
});

const currentPreview = computed(() => preview.value ?? selectedOpportunity.value ?? null);
const selectedOpportunity = computed(() =>
  opportunities.value.find((opportunity) => opportunity.destination_airport.id === selectedDestinationId.value) ?? null,
);
const topMetrics = computed(() => [
  {
    label: tr("metric.weekDemand"),
    value: formatNumber(opportunities.value[0]?.demand.origin_daily_passengers),
  },
  {
    label: tr("metric.profit"),
    tone: (opportunities.value[0]?.economics.estimated_profit_per_flight ?? 0) > 0 ? "success" as const : "warning" as const,
    value: formatMoney(opportunities.value[0]?.economics.estimated_profit_per_flight),
  },
  {
    label: tr("metric.routes"),
    value: formatNumber(routes.value.length),
  },
]);

onMounted(() => {
  airlineSimEventBus.emit("mfe:ready", { remoteId: "network-planner" });
  void loadData();
});

async function createSelectedRoute(): Promise<void> {
  const selected = currentPreview.value;
  const destinationAirportId = selected?.destination_airport.id;
  const originAirportId = selected?.origin_airport.id;

  if (!selected || !destinationAirportId || !originAirportId || selected.recommendation === "blocked") {
    return;
  }

  isCreating.value = true;
  error.value = "";
  message.value = "";

  try {
    await createRoute({
      base_frequency_per_week: 3,
      destination_airport_id: destinationAirportId,
      origin_airport_id: originAirportId,
      selected_aircraft_id: selectedAircraftId.value || selected.compatible_aircraft.find((option) => option.isCompatible)?.aircraft.id,
    });
    message.value = tr("success.created");
    airlineSimEventBus.emit("route:created", {
      destinationAirportId,
      originAirportId,
      source: "network-planner",
    });
    airlineSimEventBus.emit("game:snapshot-invalidated", {
      reason: "route-created",
      source: "network-planner",
    });
    airlineSimEventBus.emit("events:invalidated", { reason: "route-created", source: "network-planner" });
    airlineSimEventBus.emit("notifications:invalidated", { reason: "route-created", source: "network-planner" });
    airlineSimEventBus.emit("map:network-refresh-requested", {
      reason: "route-created",
      source: "network-planner",
    });
    await loadData();
  } catch (loadError) {
    error.value = errorMessage(loadError);
  } finally {
    isCreating.value = false;
  }
}

function errorMessage(value: unknown): string {
  return value instanceof Error ? value.message : "Could not load route data.";
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

async function loadData(): Promise<void> {
  isLoading.value = true;
  error.value = "";

  try {
    const [opportunityResponse, routeResponse] = await Promise.all([
      getRouteOpportunities(filters),
      getRoutes(),
    ]);
    opportunities.value = opportunityResponse.opportunities;
    routes.value = routeResponse.routes;
    selectedDestinationId.value ||= opportunities.value[0]?.destination_airport.id ?? "";
    await loadPreview();
  } catch (loadError) {
    error.value = errorMessage(loadError);
  } finally {
    isLoading.value = false;
  }
}

async function loadPreview(): Promise<void> {
  const destinationId = selectedDestinationId.value;
  if (!destinationId) {
    preview.value = null;
    return;
  }

  isPreviewLoading.value = true;

  try {
    const response = await getRoutePreview(destinationId, selectedAircraftId.value || undefined);
    preview.value = response.preview;
  } catch (loadError) {
    error.value = errorMessage(loadError);
  } finally {
    isPreviewLoading.value = false;
  }
}

function navigateToSchedule(route: StoredRoute): void {
  airlineSimEventBus.emit("navigation:intent", {
    source: "mfe",
    targetPath: `${route.next_action.target_path}?route_id=${encodeURIComponent(route.id)}`,
  });
}

function recommendationLabel(value: RouteOpportunity["recommendation"]): string {
  return tr(`recommendation.${value}` as NetworkMessageKey);
}

function recommendationVariant(value: RouteOpportunity["recommendation"]): "danger-soft" | "success-soft" | "warning-soft" {
  if (value === "open") {
    return "success-soft";
  }
  if (value === "blocked") {
    return "danger-soft";
  }
  return "warning-soft";
}

function selectOpportunity(opportunity: RouteOpportunity): void {
  selectedDestinationId.value = opportunity.destination_airport.id ?? "";
  selectedAircraftId.value = opportunity.compatible_aircraft.find((option) => option.isCompatible)?.aircraft.id ?? "";
  void loadPreview();
}

function statusLabel(status: string): string {
  const key = `status.${status}` as NetworkMessageKey;
  return key in tMap ? tr(key) : status;
}

function tr(key: NetworkMessageKey): string {
  return translateNetwork(props.appLocale, key);
}

const tMap = {
  "status.active": true,
  "status.awaiting_schedule": true,
  "status.draft": true,
  "status.paused": true,
  "status.scheduled": true,
};
</script>

<template>
  <section class="h-full overflow-y-auto bg-background p-4 text-body text-text-primary sm:p-6">
    <div class="flex flex-col gap-5 border-b border-border pb-5 lg:flex-row lg:items-end lg:justify-between">
      <div class="min-w-0">
        <AirBadge
          label="Network Planner"
          variant="warning-soft"
        />
        <h1 class="mt-4 text-h2">
          {{ tr("title") }}
        </h1>
        <p class="mt-2 max-w-2xl text-body text-text-muted">
          {{ tr("description") }}
        </p>
      </div>
      <AirButton
        :disabled="isLoading"
        :label="isLoading ? '...' : tr('action.refresh')"
        size="sm"
        variant="warning"
        @click="loadData"
      />
    </div>

    <div
      v-if="error || message"
      class="mt-4 rounded-lg border p-3"
      :class="error ? 'border-error bg-error-bg text-slate-950' : 'border-success bg-success-bg text-slate-950'"
    >
      {{ error || message }}
    </div>

    <div class="mt-6 grid gap-3 sm:grid-cols-3">
      <AirMetricCard
        v-for="metric in topMetrics"
        :key="metric.label"
        :label="metric.label"
        :tone="metric.tone"
        :value="metric.value"
      />
    </div>

    <div class="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_28rem]">
      <div class="min-w-0">
        <div class="grid gap-3 rounded-lg border border-border bg-surface p-4 md:grid-cols-4">
          <AirTextField
            v-model="filters.minDemand"
            :label="tr('filter.minDemand')"
            placeholder="120"
          />
          <AirTextField
            v-model="filters.maxDistance"
            :label="tr('filter.maxDistance')"
            placeholder="3500"
          />
          <label class="flex items-center gap-2 text-body text-text-muted">
            <input
              v-model="filters.onlyCompatible"
              type="checkbox"
            />
            {{ tr("filter.compatible") }}
          </label>
          <label class="flex items-center gap-2 text-body text-text-muted">
            <input
              v-model="filters.onlyProfitable"
              type="checkbox"
            />
            {{ tr("filter.profitable") }}
          </label>
        </div>

        <RouteOpportunityGrid
          :format-money="formatMoney"
          :format-number="formatNumber"
          :is-loading="isLoading"
          :opportunities="opportunities"
          :recommendation-label="recommendationLabel"
          :recommendation-variant="recommendationVariant"
          :selected-destination-id="selectedDestinationId"
          :t="tr"
          @select-opportunity="selectOpportunity"
        />

        <RouteListPanel
          :format-number="formatNumber"
          :routes="routes"
          :status-label="statusLabel"
          :t="tr"
          @navigate-to-schedule="navigateToSchedule"
        />
      </div>

      <RoutePreviewPanel
        :current-preview="currentPreview"
        :format-money="formatMoney"
        :format-number="formatNumber"
        :is-creating="isCreating"
        :is-preview-loading="isPreviewLoading"
        :recommendation-label="recommendationLabel"
        :recommendation-variant="recommendationVariant"
        :t="tr"
        @create-selected-route="createSelectedRoute"
      />
    </div>
  </section>
</template>
