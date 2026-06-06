<script setup lang="ts">
import { AirSelect, AirTextField } from "@airlinesim/air-ui";

import type { NetworkMessageKey } from "../i18n";

type SelectOption = {
  disabled?: boolean;
  label: string;
  value: string;
};

defineProps<{
  aircraftOptions: SelectOption[];
  maxDistance: string;
  minDemand: string;
  onlyCompatible: boolean;
  onlyProfitable: boolean;
  selectedAircraftId: string;
  t: (key: NetworkMessageKey) => string;
}>();

const emit = defineEmits<{
  "update:max-distance": [value: string];
  "update:min-demand": [value: string];
  "update:only-compatible": [value: boolean];
  "update:only-profitable": [value: boolean];
  "update:selected-aircraft-id": [value: string];
}>();

function updateOnlyCompatible(event: Event): void {
  emit("update:only-compatible", (event.target as HTMLInputElement).checked);
}

function updateOnlyProfitable(event: Event): void {
  emit("update:only-profitable", (event.target as HTMLInputElement).checked);
}
</script>

<template>
  <div class="route-planner-filters rounded-lg border border-border bg-surface p-3">
    <div class="flex min-w-0 flex-col gap-1.5">
      <span class="text-caption text-text-muted">{{ t("filter.aircraft") }}</span>
      <AirSelect
        class="w-full"
        :label="t('filter.aircraft')"
        :model-value="selectedAircraftId"
        :options="aircraftOptions"
        @update:model-value="emit('update:selected-aircraft-id', $event)"
      />
    </div>
    <AirTextField
      :model-value="minDemand"
      :label="t('filter.minDemand')"
      placeholder="120"
      @update:model-value="emit('update:min-demand', $event)"
    />
    <AirTextField
      :model-value="maxDistance"
      :label="t('filter.maxDistance')"
      placeholder="3500"
      @update:model-value="emit('update:max-distance', $event)"
    />
    <label class="flex min-h-10 items-center gap-2 rounded-lg border border-border bg-background px-3 text-body text-text-muted">
      <input
        :checked="onlyCompatible"
        class="size-4 accent-primary"
        type="checkbox"
        @change="updateOnlyCompatible"
      />
      {{ t("filter.compatible") }}
    </label>
    <label class="flex min-h-10 items-center gap-2 rounded-lg border border-border bg-background px-3 text-body text-text-muted">
      <input
        :checked="onlyProfitable"
        class="size-4 accent-primary"
        type="checkbox"
        @change="updateOnlyProfitable"
      />
      {{ t("filter.profitable") }}
    </label>
    <div class="flex min-h-10 items-center rounded-lg border border-border bg-background px-3 text-caption text-text-muted">
      {{ t("filter.autoApply") }}
    </div>
  </div>
</template>

<style scoped>
.route-planner-filters {
  display: grid;
  gap: 0.5rem;
}

@media (min-width: 1280px) {
  .route-planner-filters {
    align-items: end;
    grid-template-columns: minmax(13rem, 1.2fr) minmax(8rem, 0.75fr) minmax(8rem, 0.75fr) auto auto auto;
  }
}

@media (min-width: 768px) and (max-width: 1279px) {
  .route-planner-filters {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
