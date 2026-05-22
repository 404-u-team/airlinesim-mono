<script setup lang="ts">
import type { MapManagerSnapshot } from "map/Map";

import { AirIconButton } from "@airlinesim/air-ui";
import { type Locale, translate } from "@airlinesim/i18n";
import { Globe, Map as MapIcon, ZoomIn, ZoomOut } from "@lucide/vue";
import { computed, onBeforeUnmount, onMounted, ref } from "vue";

import { type ShellMessageKey, shellMessages } from "../i18n/messages";

type MapManagerRemote = typeof import("map/Map")["mapManager"];

const props = defineProps<{
  appLocale: Locale;
}>();

const snapshot = ref<MapManagerSnapshot | null>(null);

let mapManager: MapManagerRemote | null = null;
let unsubscribe: (() => void) | null = null;
const t = computed(() => (key: ShellMessageKey): string =>
  translate(shellMessages, props.appLocale, key),
);

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
          :label="t('map.zoomIn')"
          :disabled="!snapshot?.isReady"
          @click="zoomIn"
        >
          <ZoomIn :size="18" />
        </AirIconButton>
        <AirIconButton
          :label="t('map.zoomOut')"
          :disabled="!snapshot?.isReady"
          @click="zoomOut"
        >
          <ZoomOut :size="18" />
        </AirIconButton>
      </div>

      <div class="flex items-center gap-1">
        <AirIconButton
          :label="t('map.2d')"
          :active="snapshot?.isGlobe === false"
          :disabled="!snapshot?.isReady"
          @click="setProjection(false)"
        >
          <MapIcon :size="18" />
        </AirIconButton>
        <AirIconButton
          :label="t('map.3d')"
          :active="snapshot?.isGlobe === true"
          :disabled="!snapshot?.isReady"
          @click="setProjection(true)"
        >
          <Globe :size="18" />
        </AirIconButton>
      </div>
    </div>
  </div>
</template>
