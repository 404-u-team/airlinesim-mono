<script setup lang="ts">
import type { MapManagerSnapshot } from "map/Map";

import { AirIconButton, AirSelect } from "@airlinesim/air-ui";
import { Globe, Layers, Map as MapIcon, Pause, RotateCw, ZoomIn, ZoomOut } from "@lucide/vue";
import { computed, onBeforeUnmount, onMounted, ref } from "vue";

type MapManagerRemote = typeof import("map/Map")["mapManager"];

const snapshot = ref<MapManagerSnapshot | null>(null);

let mapManager: MapManagerRemote | null = null;
let unsubscribe: (() => void) | null = null;

const styleOptions = computed(() => {
  return (
    snapshot.value?.styles.map((style) => ({
      label: style.name,
      value: style.name,
    })) ?? []
  );
});

const selectedStyle = computed({
  get: () => snapshot.value?.selectedStyleName ?? "",
  set: (styleName: string) => {
    mapManager?.changeStyle(styleName);
  },
});

onMounted(async () => {
  const remote = await import("map/Map");
  mapManager = remote.mapManager;
  unsubscribe = remote.mapManager.subscribe((nextSnapshot) => {
    snapshot.value = nextSnapshot;
  });
});

onBeforeUnmount(() => {
  unsubscribe?.();
  unsubscribe = null;
});

function setProjection(isGlobe: boolean): void {
  mapManager?.setGlobeProjection(isGlobe);
}

function toggleRotation(): void {
  mapManager?.setRotation(!(snapshot.value?.isRotating ?? false));
}

function zoomIn(): void {
  mapManager?.zoomIn();
}

function zoomOut(): void {
  mapManager?.zoomOut();
}
</script>

<template>
  <div class="pointer-events-none absolute inset-x-0 bottom-6 z-20 flex justify-end px-6">
    <div
      class="pointer-events-auto flex flex-wrap items-center justify-end gap-3 rounded-lg border border-border bg-surface/95 p-2 shadow-lg backdrop-blur"
    >
      <div class="flex items-center gap-1">
        <AirIconButton
          label="Zoom in"
          :disabled="!snapshot?.isReady"
          @click="zoomIn"
        >
          <ZoomIn :size="18" />
        </AirIconButton>
        <AirIconButton
          label="Zoom out"
          :disabled="!snapshot?.isReady"
          @click="zoomOut"
        >
          <ZoomOut :size="18" />
        </AirIconButton>
      </div>

      <div class="flex items-center gap-1">
        <AirIconButton
          label="2D map"
          :active="snapshot?.isGlobe === false"
          :disabled="!snapshot?.isReady"
          @click="setProjection(false)"
        >
          <MapIcon :size="18" />
        </AirIconButton>
        <AirIconButton
          label="3D globe"
          :active="snapshot?.isGlobe === true"
          :disabled="!snapshot?.isReady"
          @click="setProjection(true)"
        >
          <Globe :size="18" />
        </AirIconButton>
        <AirIconButton
          :label="snapshot?.isRotating ? 'Pause globe rotation' : 'Rotate globe'"
          :active="snapshot?.isRotating === true"
          :disabled="!snapshot?.isReady"
          @click="toggleRotation"
        >
          <Pause
            v-if="snapshot?.isRotating"
            :size="18"
          />
          <RotateCw
            v-else
            :size="18"
          />
        </AirIconButton>
      </div>

      <div class="flex items-center gap-2">
        <Layers
          class="text-text-muted"
          :size="18"
          aria-hidden="true"
        />
        <AirSelect
          v-model="selectedStyle"
          label="Map style"
          :options="styleOptions"
          :disabled="!snapshot?.isReady"
        />
      </div>
    </div>
  </div>
</template>
