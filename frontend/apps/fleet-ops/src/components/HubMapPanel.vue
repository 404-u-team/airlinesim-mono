<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";

import type { FleetMessageKey } from "../i18n";
import type { RouteAirportRef } from "../types";

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
  destinationAirport?: null | RouteAirportRef;
  originAirport: null | RouteAirportRef;
  t: (key: FleetMessageKey | string) => string;
}>();

const mapContainer = ref<HTMLElement | null>(null);
let mapInstance: null | RemoteMapInstance = null;
let isMapMounting = false;

const mapState = computed(() => {
  const airportFeatures = [
    toAirportFeature(props.originAirport, "base"),
    toAirportFeature(props.destinationAirport ?? null, "route_destination"),
  ].filter((feature): feature is MapFeature => feature !== null);
  const routeFeature = buildRouteFeature(props.originAirport, props.destinationAirport ?? null);

  return {
    airports: {
      features: airportFeatures,
      type: "FeatureCollection" as const,
    },
    routes: {
      features: routeFeature ? [routeFeature] : [],
      type: "FeatureCollection" as const,
    },
    viewport: buildViewport(airportFeatures),
  };
});
const hasOrigin = computed(() => Boolean(props.originAirport?.coordinates));

onMounted(() => {
  ensureMap();
});

onBeforeUnmount(() => {
  void mapInstance?.destroy?.();
  mapInstance = null;
});

watch(
  () => [mapState.value, props.appTheme] as const,
  ([nextMapState, nextTheme]) => {
    ensureMap();
    mapInstance?.update?.({
      mapState: nextMapState,
      theme: nextTheme,
    });
  },
  { deep: true, flush: "post" },
);

function buildRouteFeature(origin: null | RouteAirportRef, destination: null | RouteAirportRef): MapFeature | null {
  if (!origin?.coordinates || !destination?.coordinates) {
    return null;
  }

  return {
    geometry: {
      coordinates: [
        [origin.coordinates.longitude, origin.coordinates.latitude],
        [destination.coordinates.longitude, destination.coordinates.latitude],
      ],
      type: "LineString",
    },
    id: destination.id,
    properties: { id: destination.id, status: "open" },
    type: "Feature",
  };
}

function buildViewport(features: MapFeature[]): { bounds?: [[number, number], [number, number]]; center?: [number, number]; zoom?: number } {
  const coordinates = features
    .filter((feature) => feature.geometry.type === "Point")
    .map((feature) => feature.geometry.coordinates)
    .filter((value): value is [number, number] => typeof value[0] === "number" && typeof value[1] === "number");

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

function toAirportFeature(airport: null | RouteAirportRef, role: "base" | "route_destination"): MapFeature | null {
  if (!airport?.coordinates || !airport.id) {
    return null;
  }

  return {
    geometry: {
      coordinates: [airport.coordinates.longitude, airport.coordinates.latitude],
      type: "Point",
    },
    id: airport.id,
    properties: {
      iata_code: airport.iata_code,
      icao_code: airport.icao_code,
      id: airport.id,
      label: airport.label,
      role,
    },
    type: "Feature",
  };
}
</script>

<template>
  <section class="flex min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-surface">
    <div class="border-b border-border px-3 py-2">
      <h3 class="text-caption font-semibold text-text-muted">
        {{ t("operations.hub.map") }}
      </h3>
    </div>
    <div
      ref="mapContainer"
      class="hub-map-canvas min-h-0"
    />
    <p
      v-if="!hasOrigin"
      class="m-3 rounded-md border border-border bg-background p-3 text-caption text-text-muted"
    >
      {{ t("operations.hub.mapEmpty") }}
    </p>
  </section>
</template>

<style scoped>
.hub-map-canvas {
  flex: 1;
  min-height: 14rem;
}
</style>
