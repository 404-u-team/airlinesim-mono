import { computed, nextTick, onBeforeUnmount, onMounted, type Ref, watch } from "vue";

import type { RouteAirport, RouteDetailResponse } from "./types";

type MapFeature = {
  geometry: {
    coordinates: [number, number] | Array<[number, number]>;
    type: "LineString" | "Point";
  };
  id?: string;
  properties: Record<string, number | string | undefined>;
  type: "Feature";
};

type MapStatePayload = {
  airports: { features: MapFeature[]; type: "FeatureCollection" };
  routes: { features: MapFeature[]; type: "FeatureCollection" };
  viewport: ReturnType<typeof buildViewport>;
};

type MountState = { instance: null | RemoteMapInstance; mounting: boolean };

// Only the lifecycle methods we call — avoids an `import()` type for the remote.
type RemoteMapInstance = {
  destroy?: () => void;
  update?: (input: { mapState: MapStatePayload; theme: "dark" | "light" }) => void;
};

// Encapsulates the lazy-loaded map remote for the route detail page: it mounts a
// single origin↔destination line and keeps it in sync with the route and theme.
export function useRouteDetailMap(
  mapContainer: Ref<HTMLElement | null>,
  getRoute: () => RouteDetailResponse["route"] | undefined,
  getTheme: () => "dark" | "light",
): void {
  const state: MountState = { instance: null, mounting: false };

  const mapState = computed(() => {
    const route = getRoute();
    const origin = route?.origin_airport;
    const destination = route?.destination_airport;
    const airportFeatures = [
      toAirportFeature(origin, "base"),
      toAirportFeature(destination, "route_destination"),
    ].filter((feature): feature is MapFeature => feature !== null);

    return {
      airports: { features: airportFeatures, type: "FeatureCollection" as const },
      routes: {
        features: origin && destination ? [toRouteFeature(origin, destination)] : [],
        type: "FeatureCollection" as const,
      },
      viewport: buildViewport(airportFeatures),
    };
  });

  const ensureMap = (): void => mountMap(mapContainer.value, state, mapState.value, getTheme());

  onMounted(ensureMap);

  onBeforeUnmount(() => {
    state.instance?.destroy?.();
    state.instance = null;
  });

  watch(
    () => [mapState.value, getTheme()] as const,
    ([nextMapState, nextTheme]) => {
      ensureMap();
      state.instance?.update?.({ mapState: nextMapState, theme: nextTheme });
    },
    { deep: true, flush: "post" },
  );
}

function buildViewport(features: MapFeature[]): { bounds?: [[number, number], [number, number]]; center?: [number, number]; zoom?: number } {
  const coordinates = features
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

function mountMap(target: HTMLElement | null, state: MountState, mapState: MapStatePayload, theme: "dark" | "light"): void {
  if (!target || state.instance || state.mounting) {
    return;
  }
  state.mounting = true;
  void nextTick()
    .then(async () => {
      // eslint-disable-next-line import-x/no-unresolved
      const remote = await import("map/Map");
      if (!target.isConnected || state.instance) {
        return;
      }
      state.instance = remote.createMap(target, { controls: false, mapState, mode: "network-planner", rotation: false, theme });
    })
    .finally(() => {
      state.mounting = false;
    });
}

function toAirportFeature(airport: null | RouteAirport | undefined, role: "base" | "route_destination"): MapFeature | null {
  if (!airport?.coordinates || !airport.id) {
    return null;
  }

  return {
    geometry: { coordinates: [airport.coordinates.longitude, airport.coordinates.latitude], type: "Point" },
    id: airport.id,
    properties: { iata_code: airport.iata_code, icao_code: airport.icao_code, id: airport.id, label: airport.label, role },
    type: "Feature",
  };
}

function toRouteFeature(origin: RouteAirport, destination: RouteAirport): MapFeature {
  return {
    geometry: {
      coordinates: [
        [origin.coordinates?.longitude ?? 0, origin.coordinates?.latitude ?? 0],
        [destination.coordinates?.longitude ?? 0, destination.coordinates?.latitude ?? 0],
      ],
      type: "LineString",
    },
    id: destination.id,
    properties: { id: destination.id ?? "", status: "open" },
    type: "Feature",
  };
}
