<script setup lang="ts">
import { AirButton } from "@airlinesim/air-ui";

import type { NetworkMessageKey } from "../i18n";
import type { StoredRoute } from "../types";

defineProps<{
  formatNumber: (value: number | undefined) => string;
  routes: StoredRoute[];
  statusLabel: (status: string) => string;
  t: (key: NetworkMessageKey) => string;
}>();

const emit = defineEmits<{
  "navigate-to-schedule": [route: StoredRoute];
}>();
</script>

<template>
  <section class="mt-5 rounded-lg border border-border bg-surface p-4">
    <h2 class="text-subtitle">
      {{ t("routes.title") }}
    </h2>
    <div class="mt-3 grid gap-3">
      <article
        v-for="route in routes"
        :key="route.id"
        class="rounded-lg border border-border bg-background p-3"
      >
        <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div class="min-w-0">
            <p class="truncate text-subtitle">
              {{ route.origin_airport?.label ?? "-" }} -> {{ route.destination_airport?.label ?? "-" }}
            </p>
            <p class="mt-1 text-caption text-text-muted">
              {{ statusLabel(route.status) }} · {{ formatNumber(route.demand_snapshot.origin_daily_passengers) }} pax/day
            </p>
          </div>
          <AirButton
            :label="t('action.schedule')"
            size="sm"
            variant="warning"
            @click="emit('navigate-to-schedule', route)"
          />
        </div>
      </article>
      <p
        v-if="routes.length === 0"
        class="text-body text-text-muted"
      >
        {{ t("empty.noRoutes") }}
      </p>
    </div>
  </section>
</template>
