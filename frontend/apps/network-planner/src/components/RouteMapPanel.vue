<script setup lang="ts">
import { computed } from "vue";

import type { NetworkMessageKey } from "../i18n";
import type { RouteOpportunity } from "../types";

const props = defineProps<{
  opportunities: RouteOpportunity[];
  selectedDestinationId: string;
  t: (key: NetworkMessageKey) => string;
}>();

const emit = defineEmits<{
  "select-opportunity": [opportunity: RouteOpportunity];
}>();

const mapItems = computed(() =>
  props.opportunities
    .filter((opportunity) => opportunity.origin_airport.coordinates && opportunity.destination_airport.coordinates)
    .slice(0, 18)
    .map((opportunity) => ({
      opportunity,
      x1: projectLongitude(opportunity.origin_airport.coordinates?.longitude ?? 0),
      x2: projectLongitude(opportunity.destination_airport.coordinates?.longitude ?? 0),
      y1: projectLatitude(opportunity.origin_airport.coordinates?.latitude ?? 0),
      y2: projectLatitude(opportunity.destination_airport.coordinates?.latitude ?? 0),
    })),
);

const selectedItem = computed(() =>
  mapItems.value.find((item) => item.opportunity.destination_airport.id === props.selectedDestinationId) ?? mapItems.value[0],
);

function pointClass(opportunity: RouteOpportunity): string {
  if (opportunity.destination_airport.id === props.selectedDestinationId) {
    return "fill-current text-warning";
  }
  if (opportunity.recommendation === "open") {
    return "fill-current text-success";
  }
  if (opportunity.recommendation === "blocked") {
    return "fill-current text-error";
  }

  return "fill-current text-primary";
}

function projectLatitude(latitude: number): number {
  return 50 - (Math.max(-75, Math.min(75, latitude)) / 75) * 42;
}

function projectLongitude(longitude: number): number {
  return ((Math.max(-180, Math.min(180, longitude)) + 180) / 360) * 100;
}
</script>

<template>
  <section class="rounded-lg border border-border bg-surface p-4">
    <h2 class="text-subtitle">
      {{ t("map.title") }}
    </h2>

    <div
      v-if="mapItems.length"
      class="mt-3 overflow-hidden rounded-md border border-border bg-background"
    >
      <svg
        aria-hidden="true"
        class="block aspect-[16/9] w-full"
        preserveAspectRatio="none"
        viewBox="0 0 100 100"
      >
        <path
          v-for="item in mapItems"
          :key="`${item.opportunity.destination_airport.id}-line`"
          class="stroke-border"
          fill="none"
          :d="`M ${item.x1} ${item.y1} Q ${(item.x1 + item.x2) / 2} ${Math.min(item.y1, item.y2) - 8} ${item.x2} ${item.y2}`"
          stroke-width="0.45"
        />
        <circle
          v-if="selectedItem"
          class="fill-current text-primary"
          :cx="selectedItem.x1"
          :cy="selectedItem.y1"
          r="1.6"
        />
        <g
          v-for="item in mapItems"
          :key="item.opportunity.destination_airport.id"
          class="cursor-pointer"
          role="button"
          tabindex="0"
          @click="emit('select-opportunity', item.opportunity)"
          @keydown.enter="emit('select-opportunity', item.opportunity)"
        >
          <circle
            :class="pointClass(item.opportunity)"
            :cx="item.x2"
            :cy="item.y2"
            r="1.8"
          />
        </g>
      </svg>
    </div>

    <p
      v-else
      class="mt-3 rounded-md border border-border bg-background p-3 text-body text-text-muted"
    >
      {{ t("map.empty") }}
    </p>
  </section>
</template>
