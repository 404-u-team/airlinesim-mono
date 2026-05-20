<script setup lang="ts">
defineProps<{
  description?: string;
  title: string;
}>();
</script>

<template>
  <section class="w-full max-w-md rounded-lg border border-border bg-surface p-6 shadow-sm">
    <div class="mb-6">
      <slot name="eyebrow" />
      <h1 class="text-h3 text-text-primary">
        {{ title }}
      </h1>
      <p
        v-if="description"
        class="mt-2 text-body text-text-muted"
      >
        {{ description }}
      </p>
    </div>
    <slot />
  </section>
</template>
