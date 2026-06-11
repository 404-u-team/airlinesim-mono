<script setup lang="ts">
import type { Locale } from "@airlinesim/i18n";

import { AirButton, AirStatePanel } from "@airlinesim/air-ui";
import { airlineSimEventBus } from "@airlinesim/event-bus";
import { computed, onMounted, onUnmounted, reactive, ref, watch } from "vue";

import type { HubItem, RouteOpportunity, StoredRoute } from "./types";

import { createRoute, getHubs, getRouteOpportunities, getRoutePreview, getRoutes } from "./api";
import HubsPanel from "./components/HubsPanel.vue";
import MyRoutesPanel from "./components/MyRoutesPanel.vue";
import RouteDetailPanel from "./components/RouteDetailPanel.vue";
import RouteMapPanel from "./components/RouteMapPanel.vue";
import RoutePlannerFilters from "./components/RoutePlannerFilters.vue";
import RoutePlannerLists from "./components/RoutePlannerLists.vue";
import RoutePreviewPanel from "./components/RoutePreviewPanel.vue";
import { type NetworkMessageKey, t as translateNetwork } from "./i18n";
import {
  errorMessage,
  formatMoney,
  formatNumber,
  parseFare,
  recommendationLabel,
  recommendationVariant,
  statusLabel,
} from "./utils";

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

const hubs = ref<HubItem[]>([]);
const selectedHubId = ref("");

const hubOptions = computed(() =>
  hubs.value.map((hub) => ({
    label: hub.label,
    value: hub.airport_id,
  })),
);
const isHubDisabled = computed(() => hubs.value.length <= 1);

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

watch([filters, selectedAircraftId, selectedHubId], ([_f, _a, newHub], [_of, _oa, oldHub]) => {
  if (oldHub === "" && newHub !== "") {return;}
  if (filterDebounce) {clearTimeout(filterDebounce);}
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
    error.value = errorMessage(loadError, tr("error.load"));
  } finally {
    isCreating.value = false;
  }
}

const formatMoneyVal = (value: number | undefined) => formatMoney(props.appLocale, value);
const formatNumberVal = (value: number | undefined) => formatNumber(props.appLocale, value);

async function loadData(): Promise<void> {
  isLoading.value = true;
  error.value = "";

  try {
    const [hubsResponse, routeResponse] = await Promise.all([
      getHubs(),
      getRoutes(),
    ]);
    hubs.value = hubsResponse.hubs;

    if (!selectedHubId.value || !hubs.value.some((h) => h.airport_id === selectedHubId.value)) {
      const baseHub = hubs.value.find((h) => h.is_base);
      selectedHubId.value = baseHub ? baseHub.airport_id : (hubs.value[0]?.airport_id ?? "");
    }

    const opportunityResponse = await getRouteOpportunities({
      ...filters,
      aircraftId: selectedAircraftId.value,
      originAirportId: selectedHubId.value || undefined,
    });

    opportunities.value = opportunityResponse.opportunities;
    routes.value = routeResponse.routes;
    if (!opportunities.value.some((opportunity) => opportunity.destination_airport.id === selectedDestinationId.value)) {
      selectedDestinationId.value = opportunities.value[0]?.destination_airport.id ?? "";
    }
    await loadPreview();
  } catch (loadError) {
    error.value = errorMessage(loadError, tr("error.load"));
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
    const response = await getRoutePreview(
      destinationId,
      selectedAircraftId.value || undefined,
      selectedHubId.value || undefined,
    );
    preview.value = response.preview;
  } catch (loadError) {
    error.value = errorMessage(loadError, tr("error.load"));
  } finally {
    isPreviewLoading.value = false;
  }
}

const navigateToSchedule = (route: StoredRoute) => airlineSimEventBus.emit("navigation:intent", {
  source: "mfe",
  targetPath: `${route.next_action.target_path}?route_id=${encodeURIComponent(route.id)}`,
});

const recommendationLabelVal = (value: RouteOpportunity["recommendation"]) => recommendationLabel(value, tr);

const selectOpportunity = (opp: RouteOpportunity) => {
  selectedDestinationId.value = opp.destination_airport.id ?? "";
  selectedAircraftId.value ||= opp.compatible_aircraft.find((opt) => opt.isCompatible)?.aircraft.id ?? "";
  void loadPreview();
};

const statusLabelVal = (status: string) => statusLabel(status, tr);

function tr(key: NetworkMessageKey): string {
  return translateNetwork(props.appLocale, key);
}
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
          <span>{{ tr("panel.results") }}: {{ formatNumberVal(opportunities.length) }}</span>
          <span>{{ tr("panel.saved") }}: {{ formatNumberVal(routes.length) }}</span>
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
        :hub-options="hubOptions"
        :is-hub-disabled="isHubDisabled"
        :max-distance="filters.maxDistance"
        :min-demand="filters.minDemand"
        :only-compatible="filters.onlyCompatible"
        :only-profitable="filters.onlyProfitable"
        :selected-aircraft-id="selectedAircraftId"
        :selected-hub-id="selectedHubId"
        :t="tr"
        @update:max-distance="filters.maxDistance = $event"
        @update:min-demand="filters.minDemand = $event"
        @update:only-compatible="filters.onlyCompatible = $event"
        @update:only-profitable="filters.onlyProfitable = $event"
        @update:selected-aircraft-id="selectedAircraftId = $event"
        @update:selected-hub-id="selectedHubId = $event"
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
          :format-money="formatMoneyVal"
          :format-number="formatNumberVal"
          :is-creating="isCreating"
          :is-preview-loading="isPreviewLoading"
          :recommendation-label="recommendationLabelVal"
          :recommendation-variant="recommendationVariant"
          :t="tr"
          @create-selected-route="createSelectedRoute"
          @update:fare-outbound="fareOutbound = $event"
          @update:fare-return="fareReturn = $event"
        />
      </div>

      <RoutePlannerLists
        :format-money="formatMoneyVal"
        :format-number="formatNumberVal"
        :is-loading="isLoading"
        :opportunities="opportunities"
        :recommendation-label="recommendationLabelVal"
        :recommendation-variant="recommendationVariant"
        :routes="routes"
        :selected-destination-id="selectedDestinationId"
        :status-label="statusLabelVal"
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
