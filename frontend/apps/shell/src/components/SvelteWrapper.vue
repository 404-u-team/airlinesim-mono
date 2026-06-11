<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from "vue";

type MaybeMapState = {
  airports?: { features?: unknown[] };
  flights?: { features?: unknown[] };
  routes?: { features?: unknown[] };
};

type RemoteSvelteFactory = (
  target: HTMLElement,
  props: Record<string, unknown>,
) => Promise<RemoteSvelteInstance> | RemoteSvelteInstance;

type RemoteSvelteInstance = {
  destroy?: () => Promise<void>;
  update?: (props: Record<string, unknown>) => void;
};

const props = withDefaults(
  defineProps<{
    componentProps?: Record<string, unknown>;
    createFn: RemoteSvelteFactory;
  }>(),
  {
    componentProps: () => ({}),
  },
);

const DEBUG_LOG_PREFIX = "[dashboard-map]";

const container = ref<HTMLElement | null>(null);
let svelteInstance: null | RemoteSvelteInstance = null;

onMounted(async () => {
  if (!container.value) {
    return;
  }

  debugComponentProps("wrapper:mount", props.componentProps);
  const instance = await props.createFn(container.value, props.componentProps);
  svelteInstance = instance;
  // The remote is loaded asynchronously; props (e.g. map state) may have changed
  // while it was importing, and those watch-driven updates were dropped because the
  // instance did not exist yet. Re-apply the latest props now that it is mounted.
  instance.update?.(props.componentProps);
});

watch(
  () => props.componentProps,
  (newProps) => {
    debugComponentProps("wrapper:update", newProps);
    svelteInstance?.update?.(newProps);
  },
  { deep: true },
);

onBeforeUnmount(() => {
  void svelteInstance?.destroy?.();
});

function debugComponentProps(message: string, componentProps: Record<string, unknown>): void {
  if (!import.meta.env.DEV || componentProps.mode !== "dashboard") {
    return;
  }

  console.warn(DEBUG_LOG_PREFIX, message, {
    ...mapStateCounts(componentProps.mapState as MaybeMapState | null | undefined),
    selectedAirportId: componentProps.selectedAirportId,
  });
}

function featuresLength(features: undefined | unknown[]): number {
  return features?.length ?? 0;
}

function mapStateCounts(mapState: MaybeMapState | null | undefined): Record<string, boolean | number> {
  return {
    airports: featuresLength(mapState?.airports?.features),
    flights: featuresLength(mapState?.flights?.features),
    hasMapState: Boolean(mapState),
    routes: featuresLength(mapState?.routes?.features),
  };
}
</script>

<template>
  <div
    ref="container"
    class="svelte-container"
  />
</template>

<style scoped>
.svelte-container {
  width: 100%;
  height: 100%;
}
</style>
