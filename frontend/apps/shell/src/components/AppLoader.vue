<script setup lang="ts">
import { Loader } from "@lucide/vue";

defineProps<{
  label?: string;
}>();
</script>

<template>
  <div class="flex flex-col items-center justify-center gap-4 py-12">
    <Loader class="h-10 w-10 animate-spin text-primary" />
    <p v-if="label" class="text-body text-text-muted">
      {{ label }}
    </p>
  </div>
</template>
