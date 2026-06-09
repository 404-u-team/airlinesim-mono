<script setup lang="ts">
import { AirTimeline, type AirTimelineItem } from "@airlinesim/air-ui";

defineProps<{
  items: AirTimelineItem[];
  t: (key: string) => string;
}>();
</script>

<template>
  <div class="rounded-lg border border-border bg-surface p-4">
    <h2 class="text-subtitle">
      {{ t("operations.timeline.title") }}
    </h2>
    <AirTimeline
      v-if="items.length"
      class="mt-4"
      :items="items"
    />
    <p
      v-else
      class="mt-4 rounded-lg border border-border bg-background p-4 text-body text-text-muted"
    >
      {{ t("operations.timeline.empty") }}
    </p>
  </div>
</template>
