<script setup lang="ts">
import type { Locale } from "@airlinesim/i18n";

import { AirButton, AirStatePanel } from "@airlinesim/air-ui";
import { airlineSimEventBus } from "@airlinesim/event-bus";
import { computed, onMounted, onUnmounted, reactive, ref, watch } from "vue";

import type { RouteOpportunity, StoredRoute } from "./types";

import { createRoute, getRouteOpportunities, getRoutePreview, getRoutes } from "./api";
import HubsPanel from "./components/HubsPanel.vue";
import MyRoutesPanel from "./components/MyRoutesPanel.vue";
import RouteDetailPanel from "./components/RouteDetailPanel.vue";
import RouteMapPanel from "./components/RouteMapPanel.vue";
import RoutePlannerFilters from "./components/RoutePlannerFilters.vue";
import RoutePlannerLists from "./components/RoutePlannerLists.vue";
import RoutePreviewPanel from "./components/RoutePreviewPanel.vue";
import { type NetworkMessageKey, t as translateNetwork } from "./i18n";

const props = defineProps<{
  appLocale: Locale;
  appTheme?: "dark" | "light";
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
const fareOutbound = ref("");
const fareReturn = ref("");
const filters = reactive({
  maxDistance: "",
  minDemand: "",
  onlyCompatible: true,
  onlyProfitable: false,
});
let filterDebounce: null | ReturnType<typeof setTimeout> = null;

const isHubsView = computed(() => Boolean(props.shellPath?.includes("/airports/hubs")));
const routeDetailId = computed(() => {
  const match = /\/airports\/my-routes\/([^/?#]+)/.exec(props.shellPath ?? "");

  return match?.[1] ? decodeURIComponent(match[1]) : "";
});
const isRouteDetailView = computed(() => Boolean(routeDetailId.value));
const isMyRoutesView = computed(() => Boolean(props.shellPath?.includes("/airports/my-routes")) && !routeDetailId.value);
const currentPreview = computed(() => preview.value ?? selectedOpportunity.value ?? null);
const selectedOpportunity = computed(() =>
  opportunities.value.find((opportunity) => opportunity.destination_airport.id === selectedDestinationId.value) ?? null,
);
const aircraftOptions = computed(() => {
  const seen = new Set<string>();
  const options = [{ label: tr("filter.aircraft.all"), value: "" }];

  for (const option of opportunities.value.flatMap((opportunity) => opportunity.compatible_aircraft)) {
    const aircraftId = option.aircraft.id ?? "";
    if (!aircraftId || seen.has(aircraftId)) {
      continue;
    }
    seen.add(aircraftId);
    options.push({
      label: `${option.aircraft.tail_number ?? aircraftId} · ${option.type?.model_name ?? option.aircraft.type_id ?? "-"}`,
      value: aircraftId,
    });
  }

  return options;
});
onMounted(() => {
  airlineSimEventBus.emit("mfe:ready", { remoteId: "network-planner" });
  void loadData();
});

onUnmounted(() => {
  if (filterDebounce) {
    clearTimeout(filterDebounce);
  }
});

watch([filters, selectedAircraftId], () => {
  if (filterDebounce) {
    clearTimeout(filterDebounce);
  }
  filterDebounce = setTimeout(() => void loadData(), 300);
}, { deep: true });

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

  const fareOverrideOutbound = parseFare(fareOutbound.value);
  const fareOverrideReturn = parseFare(fareReturn.value);
  fareOutbound.value = "";
  fareReturn.value = "";

  try {
    const created = await createRoute({
      base_frequency_per_week: 3,
      destination_airport_id: destinationAirportId,
      fare_override_outbound: fareOverrideOutbound,
      fare_override_return: fareOverrideReturn,
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
    // Jump straight into scheduling the freshly created route.
    airlineSimEventBus.emit("navigation:intent", {
      source: "mfe",
      targetPath: `/operations/schedule?route_id=${encodeURIComponent(created.route.id)}`,
    });
  } catch (loadError) {
    error.value = errorMessage(loadError);
  } finally {
    isCreating.value = false;
  }
}

function errorMessage(value: unknown): string {
  return value instanceof Error ? value.message : tr("error.load");
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
      getRouteOpportunities({ ...filters, aircraftId: selectedAircraftId.value }),
      getRoutes(),
    ]);
    opportunities.value = opportunityResponse.opportunities;
    routes.value = routeResponse.routes;
    if (!opportunities.value.some((opportunity) => opportunity.destination_airport.id === selectedDestinationId.value)) {
      selectedDestinationId.value = opportunities.value[0]?.destination_airport.id ?? "";
    }
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

// Empty / non-positive input means "use the automatic reference fare".
function parseFare(value: string): number | undefined {
  const parsed = Number(value);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
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
  selectedAircraftId.value ||= opportunity.compatible_aircraft.find((option) => option.isCompatible)?.aircraft.id ?? "";
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
  <MyRoutesPanel
    v-if="isMyRoutesView"
    :app-locale="props.appLocale"
    :t="tr"
  />
  <RouteDetailPanel
    v-else-if="isRouteDetailView"
    :app-locale="props.appLocale"
    :app-theme="props.appTheme ?? 'light'"
    :route-id="routeDetailId"
    :t="tr"
  />
  <section
    v-else
    class="route-planner-shell h-full overflow-y-auto bg-background p-3 text-body text-text-primary sm:p-4 xl:overflow-hidden"
  >
    <HubsPanel
      v-if="isHubsView"
      :app-locale="props.appLocale"
      :t="tr"
    />
    <div
      v-else
      class="route-planner-frame flex min-h-full flex-col gap-3 xl:h-full xl:min-h-0"
    >
      <div class="flex flex-col gap-3 border-b border-border pb-3 lg:flex-row lg:items-center lg:justify-between">
        <div class="min-w-0">
          <h1 class="text-h2">
            {{ tr("title") }}
          </h1>
          <p class="mt-1 max-w-3xl text-body text-text-muted">
            {{ tr("description") }}
          </p>
        </div>
        <div class="flex flex-wrap items-center gap-3 text-caption text-text-muted">
          <span>{{ tr("panel.results") }}: {{ formatNumber(opportunities.length) }}</span>
          <span>{{ tr("panel.saved") }}: {{ formatNumber(routes.length) }}</span>
          <AirButton
            :disabled="isLoading"
            :label="isLoading ? '...' : tr('action.refresh')"
            size="sm"
            variant="primary-soft"
            @click="loadData"
          />
        </div>
      </div>

      <AirStatePanel
        v-if="error"
        :title="tr('error.load')"
        :body="error"
        tone="danger"
      />
      <AirStatePanel
        v-else-if="message"
        :title="message"
        tone="success"
      />

      <RoutePlannerFilters
        :aircraft-options="aircraftOptions"
        :max-distance="filters.maxDistance"
        :min-demand="filters.minDemand"
        :only-compatible="filters.onlyCompatible"
        :only-profitable="filters.onlyProfitable"
        :selected-aircraft-id="selectedAircraftId"
        :t="tr"
        @update:max-distance="filters.maxDistance = $event"
        @update:min-demand="filters.minDemand = $event"
        @update:only-compatible="filters.onlyCompatible = $event"
        @update:only-profitable="filters.onlyProfitable = $event"
        @update:selected-aircraft-id="selectedAircraftId = $event"
      />

      <div class="route-planner-workspace">
        <RouteMapPanel
          :app-theme="props.appTheme ?? 'light'"
          :opportunities="opportunities"
          :selected-aircraft-id="selectedAircraftId"
          :selected-destination-id="selectedDestinationId"
          :t="tr"
          @select-opportunity="selectOpportunity"
        />

        <RoutePreviewPanel
          class="route-planner-preview"
          :current-preview="currentPreview"
          :fare-outbound="fareOutbound"
          :fare-return="fareReturn"
          :format-money="formatMoney"
          :format-number="formatNumber"
          :is-creating="isCreating"
          :is-preview-loading="isPreviewLoading"
          :recommendation-label="recommendationLabel"
          :recommendation-variant="recommendationVariant"
          :t="tr"
          @create-selected-route="createSelectedRoute"
          @update:fare-outbound="fareOutbound = $event"
          @update:fare-return="fareReturn = $event"
        />
      </div>

      <RoutePlannerLists
        :format-money="formatMoney"
        :format-number="formatNumber"
        :is-loading="isLoading"
        :opportunities="opportunities"
        :recommendation-label="recommendationLabel"
        :recommendation-variant="recommendationVariant"
        :routes="routes"
        :selected-destination-id="selectedDestinationId"
        :status-label="statusLabel"
        :t="tr"
        @navigate-to-schedule="navigateToSchedule"
        @select-opportunity="selectOpportunity"
      />
    </div>
  </section>
</template>

<style scoped>
.route-planner-workspace {
  display: grid;
  gap: 0.75rem;
  min-height: 0;
}

@media (min-width: 1280px) {
  .route-planner-workspace {
    height: clamp(32rem, calc(100vh - 22rem), 46rem);
    grid-template-columns: minmax(0, 1fr) 27rem;
  }
}
</style>
