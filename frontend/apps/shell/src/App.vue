<script setup lang="ts">
import { computed, defineAsyncComponent, ref } from "vue";

import MapControls from "./components/MapControls.vue";
import SvelteWrapper from "./components/SvelteWrapper.vue";

type RemoteId =
  | "events-news"
  | "finance-stock"
  | "fleet-ops"
  | "hr-facilities"
  | "map"
  | "network-planner";

const remoteItems: Array<{
  id: RemoteId;
  label: string;
}> = [
  { id: "map", label: "World Map" },
  { id: "fleet-ops", label: "Fleet & Ops" },
  { id: "finance-stock", label: "Finance & Stock" },
  { id: "network-planner", label: "Network Planner" },
  { id: "events-news", label: "Events & News" },
  { id: "hr-facilities", label: "HR & Facilities" },
];

const activeRemoteId = ref<RemoteId>("map");

const createMap = async (
  target: HTMLElement,
  props: Record<string, unknown>,
): Promise<ReturnType<typeof import("map/Map")["createMap"]>> => {
  const remote = await import("map/Map");

  return remote.createMap(target, props);
};

const remoteComponents = {
  // eslint-disable-next-line import-x/no-unresolved
  "events-news": defineAsyncComponent(() => import("eventsNews/App")),
  // eslint-disable-next-line import-x/no-unresolved
  "finance-stock": defineAsyncComponent(() => import("financeStock/App")),
  // eslint-disable-next-line import-x/no-unresolved
  "fleet-ops": defineAsyncComponent(() => import("fleetOps/App")),
  // eslint-disable-next-line import-x/no-unresolved
  "hr-facilities": defineAsyncComponent(() => import("hrFacilities/App")),
  // eslint-disable-next-line import-x/no-unresolved
  "network-planner": defineAsyncComponent(() => import("networkPlanner/App")),
};

const activeVueRemote = computed(() => {
  if (activeRemoteId.value === "map") {
    return null;
  }

  return remoteComponents[activeRemoteId.value];
});
</script>

<template>
  <div class="grid h-screen grid-cols-[260px_1fr] bg-background text-body text-text-primary">
    <aside class="border-r border-border bg-surface p-4">
      <h1 class="text-h4">
        AirlineSim
      </h1>
      <nav class="mt-6 flex flex-col gap-2">
        <button
          v-for="remote in remoteItems"
          :key="remote.id"
          type="button"
          class="rounded-lg px-3 py-2 text-left text-body transition hover:bg-surface-subtle"
          :class="remote.id === activeRemoteId ? 'bg-primary text-on-primary' : 'text-text-muted'"
          @click="activeRemoteId = remote.id"
        >
          {{ remote.label }}
        </button>
      </nav>
    </aside>

    <main class="relative min-h-0 overflow-hidden">
      <SvelteWrapper
        v-if="activeRemoteId === 'map'"
        :create-fn="createMap"
        :component-props="{ controls: false, rotation: false }"
      />
      <MapControls v-if="activeRemoteId === 'map'" />
      <Suspense v-else>
        <component :is="activeVueRemote" />
        <template #fallback>
          <div class="p-6 text-body text-text-muted">
            Loading remote...
          </div>
        </template>
      </Suspense>
    </main>
  </div>
</template>
