<script setup lang="ts">
import { AirAircraftThumb, AirBadge, AirButton, AirMetricCard, AirStatePanel } from "@airlinesim/air-ui";
import { computed } from "vue";

import type { FleetMarketResponse, FleetOwnedAircraftCard } from "../types";

const props = defineProps<{
  aircraft: FleetOwnedAircraftCard[];
  error: string;
  formatMoney: (value: number | undefined) => string;
  formatNumber: (value: number | undefined) => string;
  formatPercent: (value: number | undefined) => string;
  isLoading: boolean;
  market: FleetMarketResponse | null;
  message: string;
  t: (key: string) => string;
}>();

const emit = defineEmits<{
  navigate: [path: string];
  refresh: [];
}>();

const inServiceCount = computed(() => props.aircraft.filter((aircraft) => aircraft.in_service).length);
const maintenanceRiskCount = computed(() =>
  props.aircraft.filter((aircraft) => aircraft.maintenanceRatio < 0.35).length,
);
const modelGroups = computed(() => {
  const groups = new Map<string, { count: number; icaoCode?: string; imageUrl?: string; modelName: string }>();

  for (const aircraft of props.aircraft) {
    const existing = groups.get(aircraft.modelName);
    if (existing) {
      existing.count += 1;
    } else {
      groups.set(aircraft.modelName, {
        count: 1,
        icaoCode: aircraft.type?.icao_code,
        imageUrl: aircraft.type?.image_url,
        modelName: aircraft.modelName,
      });
    }
  }

  return Array.from(groups.values())
    .sort((left, right) => right.count - left.count)
    .slice(0, 5);
});
const readinessRatio = computed(() =>
  props.aircraft.length === 0 ? 0 : inServiceCount.value / props.aircraft.length,
);
const totalCycles = computed(() =>
  props.aircraft.reduce((sum, aircraft) => sum + (aircraft.total_cycles ?? 0), 0),
);
const totalHours = computed(() =>
  props.aircraft.reduce((sum, aircraft) => sum + (aircraft.total_flight_hours ?? 0), 0),
);
const unassignedCount = computed(() =>
  props.aircraft.filter((aircraft) => aircraft.assignment.status === "unassigned").length,
);
</script>

<template>
  <div class="flex min-h-full flex-col gap-4">
    <header class="flex flex-col gap-3 border-b border-border pb-4 lg:flex-row lg:items-center lg:justify-between">
      <div class="min-w-0">
        <h1 class="text-h2">
          {{ t("fleet.overview.title") }}
        </h1>
        <p class="mt-1 max-w-3xl text-body text-text-muted">
          {{ t("fleet.overview.subtitle") }}
        </p>
      </div>
      <div class="flex flex-wrap gap-2">
        <AirButton
          :label="t('action.refresh')"
          size="sm"
          variant="primary-soft"
          :disabled="isLoading"
          @click="emit('refresh')"
        />
        <AirButton
          :label="t('fleet.action.order')"
          size="sm"
          @click="emit('navigate', '/fleet/order/new')"
        />
      </div>
    </header>

    <AirStatePanel
      v-if="error"
      :body="error"
      :title="t('error.load')"
      tone="danger"
    />
    <AirStatePanel
      v-else-if="message"
      :title="message"
      tone="success"
    />

    <section class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      <AirMetricCard
        :label="t('fleet.metric.aircraft')"
        :value="formatNumber(aircraft.length)"
      />
      <AirMetricCard
        :hint="t('fleet.metric.readiness.hint')"
        :label="t('fleet.metric.readiness')"
        :tone="readinessRatio >= 0.75 ? 'success' : 'warning'"
        :value="formatPercent(readinessRatio)"
      />
      <AirMetricCard
        :label="t('fleet.metric.balance')"
        :value="formatMoney(market?.airline.balance)"
      />
      <AirMetricCard
        :label="t('fleet.metric.maintenanceRisk')"
        :tone="maintenanceRiskCount > 0 ? 'warning' : 'success'"
        :value="formatNumber(maintenanceRiskCount)"
      />
    </section>

    <div class="fleet-overview-grid">
      <section class="min-w-0 rounded-lg border border-border bg-surface p-4">
        <div class="flex items-start justify-between gap-3">
          <div>
            <h2 class="text-subtitle">
              {{ t("fleet.command.title") }}
            </h2>
            <p class="mt-1 text-caption text-text-muted">
              {{ t("fleet.command.subtitle") }}
            </p>
          </div>
          <AirBadge
            :label="formatPercent(readinessRatio)"
            :variant="readinessRatio >= 0.75 ? 'success-soft' : 'warning-soft'"
          />
        </div>

        <div class="mt-5 grid gap-3 sm:grid-cols-3">
          <div class="rounded-lg border border-border bg-background p-3">
            <p class="text-caption text-text-muted">
              {{ t("fleet.metric.inService") }}
            </p>
            <p class="mt-2 text-h3">
              {{ formatNumber(inServiceCount) }}
            </p>
          </div>
          <div class="rounded-lg border border-border bg-background p-3">
            <p class="text-caption text-text-muted">
              {{ t("fleet.metric.unassigned") }}
            </p>
            <p class="mt-2 text-h3">
              {{ formatNumber(unassignedCount) }}
            </p>
          </div>
          <div class="rounded-lg border border-border bg-background p-3">
            <p class="text-caption text-text-muted">
              {{ t("metric.cycles") }}
            </p>
            <p class="mt-2 text-h3">
              {{ formatNumber(totalCycles) }}
            </p>
          </div>
        </div>

        <div class="mt-5 rounded-lg border border-border bg-background p-4">
          <div class="mb-2 flex items-center justify-between text-caption text-text-muted">
            <span>{{ t("fleet.command.readiness") }}</span>
            <span>{{ formatPercent(readinessRatio) }}</span>
          </div>
          <div class="h-3 overflow-hidden rounded-full bg-surface-subtle">
            <div
              class="h-full rounded-full bg-success"
              :style="{ width: `${Math.round(readinessRatio * 100)}%` }"
            />
          </div>
        </div>

        <div class="mt-5 flex flex-wrap gap-2">
          <AirButton
            :label="t('fleet.action.aircraft')"
            size="sm"
            variant="primary-soft"
            @click="emit('navigate', '/fleet/aircraft')"
          />
          <AirButton
            :label="t('action.openRoutes')"
            size="sm"
            variant="success"
            @click="emit('navigate', '/airports/routes')"
          />
        </div>
      </section>

      <section class="min-w-0 rounded-lg border border-border bg-surface p-4">
        <h2 class="text-subtitle">
          {{ t("fleet.base.title") }}
        </h2>
        <p class="mt-1 text-caption text-text-muted">
          {{ t("fleet.base.subtitle") }}
        </p>

        <div class="mt-4 rounded-lg border border-border bg-background p-4">
          <p class="text-h3">
            {{ market?.baseAirport?.label ?? "-" }}
          </p>
          <div class="mt-3 grid gap-2 text-caption text-text-muted">
            <span>{{ t("metric.runway") }}: {{ formatNumber(market?.baseAirport?.max_runway_length_m) }} {{ t("unit.m") }}</span>
            <span>{{ t("fleet.base.slots") }}: {{ formatNumber(market?.baseAirport?.max_runway_uses_per_day) }}</span>
            <span>{{ t("fleet.base.night") }}: {{ market?.baseAirport?.works_at_night ? t("fleet.base.night.yes") : t("fleet.base.night.no") }}</span>
          </div>
        </div>

        <div class="mt-4 grid gap-2">
          <div
            v-for="group in modelGroups"
            :key="group.modelName"
            class="flex items-center justify-between gap-3 rounded-lg border border-border bg-background px-3 py-2"
          >
            <span class="flex min-w-0 items-center gap-3">
              <AirAircraftThumb
                :alt="group.modelName"
                :fallback="group.icaoCode"
                :image-url="group.imageUrl"
                size="sm"
              />
              <span class="truncate text-body">{{ group.modelName }}</span>
            </span>
            <AirBadge
              :label="formatNumber(group.count)"
              variant="primary-soft"
            />
          </div>
          <p
            v-if="modelGroups.length === 0"
            class="rounded-lg border border-border bg-background p-4 text-body text-text-muted"
          >
            {{ t("aircraft.empty.description") }}
          </p>
        </div>
      </section>

      <section class="min-w-0 rounded-lg border border-border bg-surface p-4">
        <h2 class="text-subtitle">
          {{ t("fleet.activity.title") }}
        </h2>
        <div class="mt-4 grid gap-3">
          <AirMetricCard
            :label="t('metric.hours')"
            :value="formatNumber(totalHours)"
          />
          <AirMetricCard
            :label="t('fleet.market.visible')"
            :value="formatNumber(market?.summary.visibleTypes)"
          />
          <AirMetricCard
            :label="t('fleet.market.affordable')"
            :tone="(market?.summary.affordableTypes ?? 0) > 0 ? 'success' : 'warning'"
            :value="formatNumber(market?.summary.affordableTypes)"
          />
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.fleet-overview-grid {
  display: grid;
  gap: 1rem;
}

@media (min-width: 1280px) {
  .fleet-overview-grid {
    grid-template-columns: minmax(0, 1.35fr) minmax(22rem, 0.75fr) minmax(18rem, 0.5fr);
  }
}
</style>
