<template>
  <div ref="container" class="svelte-container"></div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, watch } from 'vue';

const props = defineProps({
  createFn: { 
    type: Function, 
    required: true
  },
  componentProps: { 
    type: Object, 
    default: () => ({})
  }
});

const container = ref(null);
let svelteInstance = null;

onMounted(() => {
  if (container.value) {
    svelteInstance = props.createFn(container.value, props.componentProps);
  }
});

watch(() => props.componentProps, (newProps) => {
  if (svelteInstance && typeof svelteInstance.update === 'function') {
    svelteInstance.update(newProps);
  }
}, { deep: true });

onBeforeUnmount(() => {
  if (svelteInstance && typeof svelteInstance.destroy === 'function') {
    svelteInstance.destroy();
  }
});
</script>

<style scoped>
.svelte-container {
  width: 100%;
  height: 100%;
}
</style>