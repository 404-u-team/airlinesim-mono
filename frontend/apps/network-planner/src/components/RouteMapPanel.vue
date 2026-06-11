<script setup lang="ts">
import { airlineSimEventBus } from "@airlinesim/event-bus";
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";

import type { NetworkMessageKey } from "../i18n";
import type { RouteOpportunity } from "../types";

type MapFeature = {
  geometry: {
    coordinates: [number, number] | [number, number][];
    type: "LineString" | "Point";
  };
  id?: string;
  properties: Record<string, number | string | undefined>;
  type: "Feature";
};

type RemoteMapInstance = Awaited<ReturnType<typeof import("map/Map")["createMap"]>>;

const props = defineProps<{
  appTheme: "dark" | "light";
  opportunities: RouteOpportunity[];
  selectedAircraftId: string;
  selectedDestinationId: string;
  t: (key: NetworkMessageKey) => string;
}>();

const emit = defineEmits<{
  "select-opportunity": [opportunity: RouteOpportunity];
}>();

const mapContainer = ref<HTMLElement | null>(null);
let mapInstance: null | RemoteMapInstance = null;
let unsubscribeAirportSelected: (() => void) | null = null;
let isMapMounting = false;

const mapOpportunities = computed(() =>
  props.opportunities.filter((opportunity) =>
    hasMapCoordinates(opportunity) &&
    hasBuildableAircraft(opportunity, props.selectedAircraftId) &&
    opportunity.recommendation !== "blocked"),
);
const selectedOpportunity = computed(() =>
  mapOpportunities.value.find((opportunity) => opportunity.destination_airport.id === props.selectedDestinationId) ??
  mapOpportunities.value[0] ??
  null,
);
const mapState = computed(() => {
  const origin = selectedOpportunity.value?.origin_airport ?? mapOpportunities.value[0]?.origin_airport;
  const airportFeatures = [
    origin ? toAirportFeature(origin, "base") : null,
    ...mapOpportunities.value.map((opportunity) => toAirportFeature(
      opportunity.destination_airport,
      opportunity.destination_airport.id === props.selectedDestinationId ? "route_destination" : "opportunity",
      opportunity,
    )),
  ].filter((feature): feature is MapFeature => feature !== null);

  return {
    airports: {
      features: airportFeatures,
      type: "FeatureCollection" as const,
    },
    routes: {
      features: selectedOpportunity.value ? [toRouteFeature(selectedOpportunity.value)] : [],
      type: "FeatureCollection" as const,
    },
    viewport: buildViewport(airportFeatures),
  };
});

onMounted(() => {
  unsubscribeAirportSelected = airlineSimEventBus.on("map:airport-selected", handleAirportSelected);
  ensureMap();
});

onBeforeUnmount(() => {
  unsubscribeAirportSelected?.();
  unsubscribeAirportSelected = null;
  void mapInstance?.destroy?.();
  mapInstance = null;
});

watch(
  () => [mapState.value, props.appTheme] as const,
  ([nextMapState, nextTheme]) => {
    void ensureMap();
    mapInstance?.update?.({
      mapState: nextMapState,
      theme: nextTheme,
    });
  },
  { deep: true, flush: "post" },
);

function buildViewport(features: MapFeature[]): { bounds?: [[number, number], [number, number]]; center?: [number, number]; zoom?: number } {
  const coordinates = features
    .filter((feature) => feature.geometry.type === "Point")
    .map((feature) => feature.geometry.coordinates)
    .filter((coordinates): coordinates is [number, number] => typeof coordinates[0] === "number" && typeof coordinates[1] === "number");

  if (coordinates.length === 0) {
    return { center: [0, 0], zoom: 2 };
  }
  if (coordinates.length === 1) {
    return { center: coordinates[0], zoom: 5 };
  }

  const latitudes = coordinates.map(([, latitude]) => latitude);
  const longitudes = coordinates.map(([longitude]) => longitude);

  return {
    bounds: [
      [Math.min(...longitudes), Math.min(...latitudes)],
      [Math.max(...longitudes), Math.max(...latitudes)],
    ],
  };
}

function ensureMap(): void {
  const target = mapContainer.value;
  if (!target || mapInstance || isMapMounting) {
    return;
  }

  isMapMounting = true;
  void nextTick()
    .then(async () => {
      // eslint-disable-next-line import-x/no-unresolved
      const remote = await import("map/Map");

      if (!target.isConnected || mapInstance) {
        return;
      }

      mapInstance = remote.createMap(target, {
        controls: false,
        mapState: mapState.value,
        mode: "network-planner",
        rotation: false,
        theme: props.appTheme,
      });
    })
    .finally(() => {
      isMapMounting = false;
    });
}

function handleAirportSelected(event: { airportId: string }): void {
  const opportunity = props.opportunities.find((item) => item.destination_airport.id === event.airportId);
  if (opportunity) {
    emit("select-opportunity", opportunity);
  }
}

function hasBuildableAircraft(opportunity: RouteOpportunity, selectedAircraftId: string): boolean {
  if (selectedAircraftId) {
    return opportunity.compatible_aircraft.some((option) => option.aircraft.id === selectedAircraftId && option.isCompatible);
  }

  return opportunity.compatible_aircraft.some((option) => option.isCompatible);
}

function hasMapCoordinates(opportunity: RouteOpportunity): boolean {
  return Boolean(opportunity.origin_airport.coordinates && opportunity.destination_airport.coordinates);
}

function toAirportFeature(
  airport: RouteOpportunity["destination_airport"],
  role: "base" | "opportunity" | "route_destination",
  opportunity?: RouteOpportunity,
): MapFeature | null {
  const { coordinates, id } = airport;
  if (!coordinates || !id) {
    return null;
  }

  return {
    geometry: {
      coordinates: [coordinates.longitude, coordinates.latitude],
      type: "Point",
    },
    id,
    properties: {
      demand: opportunity?.demand.origin_daily_passengers,
      iata_code: airport.iata_code,
      icao_code: airport.icao_code,
      id,
      label: airport.label,
      role,
      score: opportunity?.score,
    },
    type: "Feature",
  };
}

function toRouteFeature(opportunity: RouteOpportunity): MapFeature {
  const origin = opportunity.origin_airport.coordinates;
  const destination = opportunity.destination_airport.coordinates;

  return {
    geometry: {
      coordinates: [
        [origin?.longitude ?? 0, origin?.latitude ?? 0],
        [destination?.longitude ?? 0, destination?.latitude ?? 0],
      ],
      type: "LineString",
    },
    id: opportunity.destination_airport.id,
    properties: {
      demand: opportunity.demand.origin_daily_passengers,
      id: opportunity.destination_airport.id,
      profit: opportunity.economics.estimated_profit_per_flight,
      status: opportunity.recommendation,
    },
    type: "Feature",
  };
}
</script>

<template>
  <section class="route-map-panel flex min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-surface">
    <div class="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
      <h2 class="text-subtitle">
        {{ t("map.title") }}
      </h2>
      <span class="text-caption text-text-muted">
        {{ mapOpportunities.length }} {{ t("map.available") }}
      </span>
    </div>
    <div
      ref="mapContainer"
      class="route-map-canvas min-h-0"
    />
    <p
      v-if="!mapOpportunities.length"
      class="m-4 rounded-md border border-border bg-background p-3 text-body text-text-muted"
    >
      {{ t("map.empty") }}
    </p>
  </section>
</template>

<style scoped>
.route-map-canvas {
  flex: 1;
  min-height: 24rem;
}

.route-map-panel {
  min-height: 32rem;
}

@media (min-width: 1280px) {
  .route-map-canvas {
    min-height: 0;
  }

  .route-map-panel {
    height: 100%;
    min-height: 0;
  }
}
</style>
