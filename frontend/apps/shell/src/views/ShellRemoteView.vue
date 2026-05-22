<script setup lang="ts">
import { airlineSimEventBus, type RemoteId } from "@airlinesim/event-bus";
import { type Locale, translate } from "@airlinesim/i18n";
import { computed, defineAsyncComponent, watch } from "vue";
import { useRoute } from "vue-router";

import AppLoader from "../components/AppLoader.vue";
import MapControls from "../components/MapControls.vue";
import SvelteWrapper from "../components/SvelteWrapper.vue";
import { type ShellMessageKey, shellMessages } from "../i18n/messages";
import { getRemoteIdByPath } from "../navigation";

const props = defineProps<{
  appLocale: Locale;
  appTheme: "dark" | "light";
}>();

const route = useRoute();

const activeRemoteId = computed<RemoteId | undefined>(() => {
  const { remoteId } = route.meta;

  if (typeof remoteId === "string") {
    return remoteId as RemoteId;
  }

  return getRemoteIdByPath(route.path);
});

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
  if (!activeRemoteId.value || activeRemoteId.value === "map") {
    return null;
  }

  return remoteComponents[activeRemoteId.value];
});
const t = computed(() => (key: ShellMessageKey): string =>
  translate(shellMessages, props.appLocale, key),
);

watch(
  () => route.path,
  (path, fromPath) => {
    const remoteId = getRemoteIdByPath(path);

    if (remoteId) {
      airlineSimEventBus.emit("navigation:changed", {
        fromPath,
        navigationId: `${Date.now()}:${path}`,
        path,
        remoteId,
      });
      airlineSimEventBus.emit("navigation:remote-selected", {
        path,
        remoteId,
      });
    }
  },
  { immediate: true },
);
</script>

<template>
  <main class="relative min-h-0 overflow-hidden bg-background">
    <template v-if="activeRemoteId === 'map'">
      <SvelteWrapper
        :key="activeRemoteId"
        :create-fn="createMap"
        :component-props="{ appLocale: props.appLocale, controls: false, remoteId: activeRemoteId, rotation: false, shellPath: route.path, theme: props.appTheme }"
      />
      <MapControls :app-locale="props.appLocale" />
    </template>
    <Suspense v-else-if="activeRemoteId">
      <component
        :is="activeVueRemote"
        :key="activeRemoteId"
        :remote-id="activeRemoteId"
        :app-locale="props.appLocale"
        :shell-path="route.path"
      />
      <template #fallback>
        <AppLoader :label="t('remote.loading')" />
      </template>
    </Suspense>
    <div
      v-else
      class="flex h-full flex-col items-center justify-center p-12 text-center"
    >
      <div class="max-w-md">
        <h2 class="text-h3 text-text-primary">
          {{ t("empty.title") }}
        </h2>
        <p class="mt-2 text-body text-text-muted">
          {{ t("empty.description").replace("{path}", route.path) }}
        </p>
      </div>
    </div>
  </main>
</template>
