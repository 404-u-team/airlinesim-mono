<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from "vue";

type RemoteSvelteInstance = {
  destroy?: () => Promise<void>;
  update?: (props: Record<string, unknown>) => void;
};

const props = withDefaults(
  defineProps<{
    componentProps?: Record<string, unknown>;
    createFn: (target: HTMLElement, props: Record<string, unknown>) => RemoteSvelteInstance;
  }>(),
  {
    componentProps: () => ({}),
  },
);

const container = ref<HTMLElement | null>(null);
let svelteInstance: null | RemoteSvelteInstance = null;

onMounted(() => {
  if (container.value) {
    svelteInstance = props.createFn(container.value, props.componentProps);
  }
});

watch(
  () => props.componentProps,
  (newProps) => {
    svelteInstance?.update?.(newProps);
  },
  { deep: true },
);

onBeforeUnmount(() => {
  void svelteInstance?.destroy?.();
});
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
