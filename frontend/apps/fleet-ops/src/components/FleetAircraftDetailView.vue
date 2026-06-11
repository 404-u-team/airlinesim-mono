<script setup lang="ts">
import { AirBadge, AirButton, AirMetricCard, AirStatePanel, AirTextField } from "@airlinesim/air-ui";
import { Plane } from "@lucide/vue";
import { computed } from "vue";

import type { FleetOwnedAircraftCard } from "../types";

const props = defineProps<{
  aircraft: FleetOwnedAircraftCard | null;
  editTailNumber: string;
  error: string;
  formatNumber: (value: number | undefined) => string;
  formatPercent: (value: number | undefined) => string;
  isLoading: boolean;
  isTailSaving: boolean;
  t: (key: string) => string;
}>();

const emit = defineEmits<{
  navigate: [path: string];
  refresh: [];
  save: [];
  "update-edit-tail-number": [value: string];
}>();

const editTailNumberModel = computed({
  get: () => props.editTailNumber,
  set: (value: string) => emit("update-edit-tail-number", value),
});
const statusTone = computed(() =>
  props.aircraft?.maintenanceRatio && props.aircraft.maintenanceRatio < 0.35 ? "warning-soft" : "success-soft",
);

function airportCity(label: string): string {
  return label.includes(" - ") ? label.split(" - ").slice(1).join(" - ") : label;
}

function airportCode(label: string, fallback?: string): string {
  return label.includes(" - ") ? label.split(" - ")[0] ?? fallback ?? "----" : fallback ?? label;
}

function formatDuration(ms: number): string {
  const totalMinutes = Math.max(0, Math.round(ms / 60_000));

  return `${Math.floor(totalMinutes / 60)}${props.t("unit.hourShort")} ${totalMinutes % 60}${props.t("unit.minuteShort")}`;
}

function statusBadge(flight: any) {
  const phase = flight.telemetry?.phase;
  const {status} = flight;

  const isAirborne = flight.telemetry && !["arrived", "boarding", "deplaning", "scheduled"].includes(phase ?? "");
  const isDone = phase === "arrived" || status === "completed";

  if (status === "cancelled") {
    return { label: props.t("flight.status.cancelled"), variant: "danger-soft" as const };
  }
  if (isDone) {
    return { label: props.t("flight.phase.arrived"), variant: "success-soft" as const };
  }
  if (isAirborne) {
    return { label: props.t("flight.operatesNormally") || props.t("flight.status.in_flight"), variant: "success-soft" as const };
  }
  if (phase === "boarding") {
    return { label: props.t("flight.phase.boarding") || props.t("flight.status.boarding"), variant: "warning-soft" as const };
  }

  return { label: props.t(`flight.phase.${phase}`) || props.t(`flight.status.${status}`), variant: "primary-soft" as const };
}
</script>

<template>
  <div class="flex min-h-full flex-col gap-4">
    <header class="flex flex-col gap-3 border-b border-border pb-4 lg:flex-row lg:items-center lg:justify-between">
      <div class="min-w-0">
        <h1 class="truncate text-h2">
          {{ aircraft?.tail_number ?? aircraft?.id ?? t("aircraft.detail.title") }}
        </h1>
        <p class="mt-1 max-w-3xl truncate text-body text-text-muted">
          {{ aircraft?.modelName ?? t("aircraft.notSelected") }}
        </p>
      </div>
      <div class="flex flex-wrap gap-2">
        <AirButton
          :label="t('fleet.action.aircraft')"
          size="sm"
          variant="primary-soft"
          @click="emit('navigate', '/fleet/aircraft')"
        />
        <AirButton
          :disabled="isLoading"
          :label="t('action.refresh')"
          size="sm"
          variant="primary-soft"
          @click="emit('refresh')"
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
      v-if="!aircraft && !isLoading"
      :body="t('aircraft.notSelected')"
      :title="t('aircraft.detail.title')"
    >
      <template #action>
        <AirButton
          :label="t('fleet.action.aircraft')"
          size="sm"
          @click="emit('navigate', '/fleet/aircraft')"
        />
      </template>
    </AirStatePanel>

    <div
      v-if="aircraft"
      class="fleet-detail-grid"
    >
      <section class="min-w-0 rounded-lg border border-border bg-surface p-4">
        <div class="overflow-hidden rounded-lg border border-border bg-background">
          <img
            v-if="aircraft.type?.image_url"
            :alt="aircraft.modelName"
            class="h-72 w-full object-cover"
            loading="lazy"
            :src="aircraft.type.image_url"
          />
          <div
            v-else
            class="grid h-72 place-items-center text-h2 text-text-muted"
          >
            {{ aircraft.type?.icao_code ?? "----" }}
          </div>
        </div>

        <div class="mt-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div class="min-w-0">
            <h2 class="truncate text-h3">
              {{ aircraft.tail_number ?? aircraft.id }}
            </h2>
            <p class="mt-1 text-body text-text-muted">
              {{ aircraft.modelName }} · {{ aircraft.baseAirportName }}
            </p>
          </div>
          <AirBadge
            :label="aircraft.in_service ? t('aircraft.inService') : t('fleet.filter.status.unassigned')"
            :variant="statusTone"
          />
        </div>

        <div class="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <AirMetricCard
            :label="t('metric.range')"
            :value="`${formatNumber(aircraft.type?.max_range_km)} ${t('unit.km')}`"
          />
          <AirMetricCard
            :label="t('metric.seats')"
            :value="formatNumber(aircraft.type?.max_planned_seat_capacity)"
          />
          <AirMetricCard
            :label="t('metric.runway')"
            :value="`${formatNumber(aircraft.type?.min_runway_length_m)} ${t('unit.m')}`"
          />
          <AirMetricCard
            :label="t('metric.hours')"
            :value="formatNumber(aircraft.total_flight_hours)"
          />
          <AirMetricCard
            :label="t('metric.cycles')"
            :value="formatNumber(aircraft.total_cycles)"
          />
          <AirMetricCard
            :label="t('metric.maintenance')"
            :tone="aircraft.maintenanceRatio < 0.35 ? 'warning' : 'success'"
            :value="formatPercent(aircraft.maintenanceRatio)"
          />
        </div>
      </section>

      <aside class="grid min-w-0 content-start gap-4">
        <section
          v-if="aircraft.currentLocation"
          class="rounded-lg border border-border bg-surface p-4"
        >
          <h2 class="text-subtitle mb-4">
            {{ t("aircraft.location.title") }}
          </h2>
          <div>
            <!-- If at airport -->
            <div v-if="aircraft.currentLocation.type === 'airport'" class="flex items-center gap-2 min-w-0">
              <span class="text-primary text-lg shrink-0" aria-hidden="true">📍</span>
              <div class="min-w-0">
                <p class="text-body font-semibold">
                  {{ t("aircraft.location.atAirport") }}
                </p>
                <p class="text-caption text-text-muted mt-0.5 truncate" :title="aircraft.currentLocation.airport?.label || t('aircraft.location.unknown')">
                  {{ aircraft.currentLocation.airport?.label || t("aircraft.location.unknown") }}
                </p>
              </div>
            </div>

            <!-- If in flight -->
            <div v-else-if="aircraft.currentLocation.type === 'flight' && aircraft.currentLocation.flight" class="flex flex-col gap-3">
              <div class="flex items-center justify-between">
                <span class="flex items-center gap-1.5 text-body font-bold text-primary">
                  <Plane class="size-4" /> {{ aircraft.currentLocation.flight.flight_number }}
                </span>
                <AirBadge
                  :label="statusBadge(aircraft.currentLocation.flight).label"
                  :variant="statusBadge(aircraft.currentLocation.flight).variant"
                />
              </div>

              <div class="flex items-center justify-between gap-2 w-full min-w-0">
                <div class="flex-1 min-w-0">
                  <p
                    class="text-h3 leading-none font-bold truncate"
                    :title="airportCode(aircraft.currentLocation.flight.origin_airport?.label ?? '', aircraft.currentLocation.flight.origin_airport_id)"
                  >
                    {{ airportCode(aircraft.currentLocation.flight.origin_airport?.label ?? '', aircraft.currentLocation.flight.origin_airport_id) }}
                  </p>
                  <p
                    class="mt-1 truncate text-caption text-text-muted"
                    :title="airportCity(aircraft.currentLocation.flight.origin_airport?.label ?? aircraft.currentLocation.flight.origin_airport_id)"
                  >
                    {{ airportCity(aircraft.currentLocation.flight.origin_airport?.label ?? aircraft.currentLocation.flight.origin_airport_id) }}
                  </p>
                </div>
                <span aria-hidden="true" class="shrink-0 px-1 text-subtitle text-primary">→</span>
                <div class="flex-1 min-w-0 text-right">
                  <p
                    class="text-h3 leading-none font-bold truncate"
                    :title="airportCode(aircraft.currentLocation.flight.destination_airport?.label ?? '', aircraft.currentLocation.flight.destination_airport_id)"
                  >
                    {{ airportCode(aircraft.currentLocation.flight.destination_airport?.label ?? '', aircraft.currentLocation.flight.destination_airport_id) }}
                  </p>
                  <p
                    class="mt-1 truncate text-caption text-text-muted"
                    :title="airportCity(aircraft.currentLocation.flight.destination_airport?.label ?? aircraft.currentLocation.flight.destination_airport_id)"
                  >
                    {{ airportCity(aircraft.currentLocation.flight.destination_airport?.label ?? aircraft.currentLocation.flight.destination_airport_id) }}
                  </p>
                </div>
              </div>

              <!-- Progress bar -->
              <div class="h-1.5 overflow-hidden rounded-full bg-surface-subtle">
                <div
                  class="h-full rounded-full bg-primary transition-[width] duration-1000 ease-linear"
                  :style="{ width: `${aircraft.currentLocation.flight.telemetry.progress * 100}%` }"
                />
              </div>

              <div class="flex justify-between text-caption text-text-muted">
                <span>
                  {{ t("flight.detail.eta") }}: {{ formatDuration(aircraft.currentLocation.flight.telemetry.eta_minutes * 60_000) }}
                </span>
              </div>

              <AirButton
                class="w-full mt-1"
                :label="t('aircraft.location.viewFlight')"
                size="sm"
                variant="primary-soft"
                @click="emit('navigate', '/operations/live-flights/' + aircraft.currentLocation.flight.id)"
              />
            </div>
          </div>
        </section>

        <section class="rounded-lg border border-border bg-surface p-4">
          <h2 class="text-subtitle">
            {{ t("fleet.detail.identity") }}
          </h2>
          <AirTextField
            v-model="editTailNumberModel"
            class="mt-4"
            :hint="t('tail.hint')"
            :label="t('aircraft.tail')"
          />
          <AirButton
            class="mt-3 w-full"
            :disabled="isTailSaving"
            :label="isTailSaving ? t('fleet.action.saving') : t('action.save')"
            size="sm"
            @click="emit('save')"
          />
        </section>

        <section class="rounded-lg border border-border bg-surface p-4">
          <h2 class="text-subtitle">
            {{ t("fleet.detail.assignment") }}
          </h2>
          <p class="mt-2 text-body text-text-muted">
            {{ aircraft.assignment.label || t("aircraft.assignment.pending") }}
          </p>
          <AirButton
            class="mt-4 w-full"
            :label="t('action.planRoute')"
            size="sm"
            variant="success"
            @click="emit('navigate', '/airports/routes')"
          />
        </section>

        <section class="rounded-lg border border-border bg-surface p-4">
          <h2 class="text-subtitle">
            {{ t("fleet.detail.type") }}
          </h2>
          <dl class="mt-3 grid gap-2 text-caption text-text-muted">
            <div class="flex justify-between gap-3">
              <dt>{{ t("metric.speed") }}</dt>
              <dd class="text-text-primary">
                {{ formatNumber(aircraft.type?.cruising_speed_kph) }} {{ t("unit.kph") }}
              </dd>
            </div>
            <div class="flex justify-between gap-3">
              <dt>{{ t("metric.fuel") }}</dt>
              <dd class="text-text-primary">
                {{ formatNumber(aircraft.type?.fuel_consumption_per_hour) }} {{ t("unit.kgHour") }}
              </dd>
            </div>
            <div class="flex justify-between gap-3">
              <dt>{{ t("metric.price") }}</dt>
              <dd class="text-text-primary">
                {{ formatNumber(aircraft.type?.price_per_unit) }}
              </dd>
            </div>
          </dl>
        </section>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.fleet-detail-grid {
  display: grid;
  gap: 1rem;
}

@media (min-width: 1280px) {
  .fleet-detail-grid {
    grid-template-columns: minmax(0, 1fr) 24rem;
  }
}
</style>
