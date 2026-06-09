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

function airportCode(airport: StoredRoute["destination_airport"]): string {
  return airport?.iata_code || airport?.icao_code || airport?.id || "-";
}
</script>

<template>
  <section class="h-full overflow-y-auto overflow-x-hidden bg-surface">
    <div class="divide-y divide-border">
      <article
        v-for="route in routes"
        :key="route.id"
        class="min-w-0 px-3 py-2.5 hover:bg-surface-subtle"
      >
        <div class="grid min-w-0 gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
          <div class="min-w-0">
            <div class="grid min-w-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
              <div class="min-w-0">
                <p class="text-subtitle">
                  {{ airportCode(route.origin_airport) }}
                </p>
                <p class="truncate text-caption text-text-muted">
                  {{ route.origin_airport?.label ?? "-" }}
                </p>
              </div>
              <span
                aria-hidden="true"
                class="route-list-direction"
              />
              <div class="min-w-0">
                <p class="text-subtitle">
                  {{ airportCode(route.destination_airport) }}
                </p>
                <p class="truncate text-caption text-text-muted">
                  {{ route.destination_airport?.label ?? "-" }}
                </p>
              </div>
            </div>
            <p class="mt-1 text-caption text-text-muted">
              {{ statusLabel(route.status) }} · {{ formatNumber(route.demand_snapshot.origin_daily_passengers) }} {{ t("metric.paxPerDay") }}
            </p>
          </div>
          <AirButton
            class="justify-self-start sm:justify-self-end"
            :label="t('action.schedule')"
            size="sm"
            variant="warning"
            @click="emit('navigate-to-schedule', route)"
          />
        </div>
      </article>
      <p
        v-if="routes.length === 0"
        class="p-3 text-body text-text-muted"
      >
        {{ t("empty.noRoutes") }}
      </p>
    </div>
  </section>
</template>

<style scoped>
.route-list-direction {
  align-items: center;
  color: var(--color-text-muted);
  display: inline-flex;
  height: 1.25rem;
  justify-content: center;
  width: 1.5rem;
}

.route-list-direction::before {
  background: currentcolor;
  content: "";
  height: 0.125rem;
  width: 1rem;
}

.route-list-direction::after {
  border-right: 0.125rem solid currentcolor;
  border-top: 0.125rem solid currentcolor;
  content: "";
  height: 0.4rem;
  margin-left: -0.4rem;
  transform: rotate(45deg);
  width: 0.4rem;
}
</style>
