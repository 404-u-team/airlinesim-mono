<script setup lang="ts">
import { AirAircraftThumb, AirBadge } from "@airlinesim/air-ui";

import type { NetworkMessageKey } from "../i18n";
import type { RouteDetailAircraft } from "../types";

defineProps<{
  aircraft: RouteDetailAircraft;
  t: (key: NetworkMessageKey) => string;
}>();

const emit = defineEmits<{
  open: [aircraftId: string];
}>();
</script>

<template>
  <button
    class="flex w-full items-center gap-3 rounded-md border border-border bg-background px-3 py-2 text-left transition hover:border-primary"
    type="button"
    @click="aircraft.id && emit('open', aircraft.id)"
  >
    <AirAircraftThumb
      :alt="aircraft.type?.model_name ?? aircraft.modelName"
      :fallback="aircraft.type?.icao_code"
      :image-url="aircraft.type?.image_url"
      size="md"
    />
    <div class="min-w-0 flex-1">
      <p class="truncate text-body">
        {{ aircraft.tail_number ?? aircraft.id }}
        <span class="text-text-muted">· {{ aircraft.type?.model_name ?? aircraft.modelName ?? aircraft.type_id }}</span>
      </p>
      <p
        v-if="aircraft.baseAirportName"
        class="truncate text-caption text-text-muted"
      >
        {{ aircraft.baseAirportName }}
      </p>
    </div>
    <AirBadge
      v-if="aircraft.status"
      class="shrink-0"
      :label="aircraft.status"
      variant="primary-soft"
    />
  </button>
</template>
