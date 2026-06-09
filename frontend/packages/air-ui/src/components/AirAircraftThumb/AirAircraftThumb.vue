<script setup lang="ts">
import { computed } from "vue";

type ThumbSize = "lg" | "md" | "sm";

const props = withDefaults(
  defineProps<{
    alt?: string;
    fallback?: string;
    imageUrl?: string;
    size?: ThumbSize;
  }>(),
  {
    alt: undefined,
    fallback: "----",
    imageUrl: undefined,
    size: "md",
  },
);

const sizeClasses: Record<ThumbSize, string> = {
  lg: "size-16 rounded-lg text-caption",
  md: "size-12 rounded-lg text-caption",
  sm: "size-10 rounded-md text-caption",
};

const containerClass = computed(() => [
  "grid shrink-0 place-items-center overflow-hidden border border-border bg-background text-text-muted",
  sizeClasses[props.size],
]);
</script>

<template>
  <span :class="containerClass">
    <img
      v-if="imageUrl"
      :alt="alt ?? fallback"
      class="size-full object-cover"
      loading="lazy"
      :src="imageUrl"
    />
    <template v-else>{{ fallback }}</template>
  </span>
</template>
